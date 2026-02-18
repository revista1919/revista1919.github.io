import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import CalendarComponent from './CalendarComponent';
const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const INCOMING_CSV = process.env.REACT_APP_FORM_CSV || '';
const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const sanitizeInput = (input) => input ? input.trim().toLowerCase().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : '';
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return null;
  let year, month, day;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
    if (month > 12 || day > 31 || month < 1 || day < 1 || isNaN(year) || isNaN(month) || isNaN(day)) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (month > 12 || day > 31 || month < 1 || day < 1 || isNaN(year) || isNaN(month) || isNaN(day)) {
        return null;
      }
    }
    month -= 1;
  }
  return new Date(Date.UTC(year, month, day));
};
// --- STYLED ATOMIC COMPONENTS ---
const StatusBadge = ({ type }) => {
  const styles = {
    assigned: "bg-emerald-50 text-emerald-700 border-emerald-100",
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    overdue: "bg-rose-50 text-rose-700 border-rose-100"
  };
  const label = type === 'assigned' ? 'In Process' : type === 'pending' ? 'Unassigned' : 'Overdue';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[type]}`}>
      {label}
    </span>
  );
};
const MetricCard = ({ label, value, color }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-3xl font-serif font-bold ${color}`}>{value}</p>
  </div>
);
const ARTICLE_LINK_COLUMN = 'Insert your paper in Word format here. It must be 1,000 to 10,000 words. Remember not to include your name in the document.';
export default function AssignSection({ user, onClose }) {
  const [activeView, setActiveView] = useState('articles'); // 'articles' | 'collaborators' | 'calendar' | 'spreadsheets'
  const [users, setUsers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [sectionEditors, setSectionEditors] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({});
  const [isSending, setIsSending] = useState({});
  const [emailPreview, setEmailPreview] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersText, incomingText, assignmentsText] = await Promise.all([
          fetch(USERS_CSV, { cache: 'no-store' }).then(r => r.text()),
          fetch(INCOMING_CSV, { cache: 'no-store' }).then(r => r.text()),
          fetch(ASSIGNMENTS_CSV, { cache: 'no-store' }).then(r => r.text()),
        ]);
        const parsedUsers = Papa.parse(usersText, { header: true, skipEmptyLines: true }).data.filter(u => u.Nombre && u.Nombre.trim());
        const filteredUsers = parsedUsers.filter(u => {
          const roles = (u['Role in the Journal'] || u['Rol en la Revista'] || '').split(';').map(r => r.trim()).filter(Boolean);
          return roles.some(r => r === 'Reviewer' || r === 'Section Editor' || r === 'Editor-in-Chief' || r === 'Revisor' || r === 'Editor de Sección' || r === 'Editor en Jefe');
        });
        setUsers(filteredUsers);
        const revs = filteredUsers.filter(u => (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Reviewer') || (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Revisor'));
        const eds = filteredUsers.filter(u => (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Section Editor') || (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Editor de Sección'));
        const chiefs = filteredUsers.filter(u => (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Editor-in-Chief') || (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Editor en Jefe'));
        setReviewers([...revs, ...eds, ...chiefs]);
        setSectionEditors([...eds, ...chiefs]);
        const parsedIncoming = Papa.parse(incomingText, { header: true, skipEmptyLines: true }).data.filter(i =>
          (i['Name (first name and last name)'] || i['Nombre (primer nombre y primer apellido)']) &&
          (i['Title of your paper'] || i['Título de su artículo']) &&
          (i['Name (first name and last name)'] || i['Nombre (primer nombre y primer apellido)']).trim() &&
          (i['Title of your paper'] || i['Título de su artículo']).trim()
        );
        setIncoming(parsedIncoming);
        const parsedAssignments = Papa.parse(assignmentsText, { header: true, skipEmptyLines: true }).data.filter(a =>
          a['Nombre Artículo'] && a['Nombre Artículo'].trim() && a.Autor && a.Autor.trim()
        );
        setAllAssignments(parsedAssignments);
        const pending = parsedAssignments.filter(a => !isCompleted(a));
        setPendingAssignments(pending);
      } catch (err) {
        console.error('❌ Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  const isCompleted = (assign) => {
    return !!assign?.['Feedback 3'] && assign['Feedback 3'].trim() !== '';
  };
  const groupedIncoming = useMemo(() => {
    const groupMap = {};
    incoming.forEach(art => {
      const nameKey = art['Name (first name and last name)'] || art['Nombre (primer nombre y primer apellido)'] || '';
      const titleKey = art['Title of your paper'] || art['Título de su artículo'] || '';
      const authorSanitized = sanitizeInput(nameKey);
      const titleSanitized = sanitizeInput(titleKey);
      if (!groupMap[authorSanitized]) {
        groupMap[authorSanitized] = [];
      }
      let matchingAssign = allAssignments.find(a => {
        const aTitleSanitized = sanitizeInput(a['Nombre Artículo'] || '');
        const aAuthorSanitized = sanitizeInput(a.Autor || '');
        const exactMatch = aTitleSanitized === titleSanitized && aAuthorSanitized === authorSanitized;
        const fuzzyTitleMatch = !exactMatch && (
          aTitleSanitized.includes(titleSanitized) ||
          titleSanitized.includes(aTitleSanitized)
        );
        return exactMatch || (fuzzyTitleMatch && aAuthorSanitized === authorSanitized);
      });
      if (matchingAssign && isCompleted(matchingAssign)) {
        return;
      }
      groupMap[authorSanitized].push({ ...art, assignment: matchingAssign });
    });
    return Object.entries(groupMap)
      .filter(([sanitizedAuthor, articles]) => articles.length > 0)
      .map(([sanitizedAuthor, articles]) => ({
        authorName: articles[0]['Name (first name and last name)'] || articles[0]['Nombre (primer nombre y primer apellido)'],
        authorEmail: articles[0]['Email direction'] || articles[0]['Correo electrónico'],
        authorInstitution: articles[0]['Educational establishment'] || articles[0]['Establecimiento educacional'],
        articles: articles.filter(art => !(art.assignment && isCompleted(art.assignment))),
      })).filter(group => group.articles.length > 0);
  }, [incoming, allAssignments]);
  const totalPending = groupedIncoming.reduce((sum, group) => sum + group.articles.length, 0);
  const calendarEvents = useMemo(() => {
    return pendingAssignments.map(a => ({
      title: a['Nombre Artículo'],
      start: parseDate(a.Plazo),
      end: parseDate(a.Plazo),
      allDay: true,
      resource: a,
    })).filter(event => event.start);
  }, [pendingAssignments]);
  const handleSelectEvent = (event) => {
    const assignment = event.resource;
    const titleSanitized = sanitizeInput(assignment['Nombre Artículo']);
    const authorSanitized = sanitizeInput(assignment.Autor);
    for (const group of groupedIncoming) {
      if (sanitizeInput(group.authorName) === authorSanitized) {
        const art = group.articles.find(a => sanitizeInput(a['Title of your paper'] || a['Título de su artículo'] || '') === titleSanitized);
        if (art) {
          const uniqueId = getUniqueId(group.authorName, art['Title of your paper'] || art['Título de su artículo']);
          const defData = {
            nombre: assignment['Nombre Artículo'] || art['Title of your paper'] || art['Título de su artículo'] || '',
            link: assignment['Link Artículo'] || art[ARTICLE_LINK_COLUMN] || '',
            r1: assignment['Revisor 1'] || '',
            r2: assignment['Revisor 2'] || '',
            editor: assignment.Editor || '',
            plazo: assignment.Plazo ? parseDate(assignment.Plazo) : null,
          };
          setEditingData({
            id: uniqueId,
            data: defData,
            isUpdate: true,
            author: assignment.Autor,
            area: art['Area of the paper (e.g.: economics)'] || art['Área del artículo (e.g.: economía)'],
          });
          setEditingId(uniqueId);
          break;
        }
      }
    }
  };
  const handleAssignOrUpdate = async (data, isUpdate = false) => {
    const action = isUpdate ? 'update' : 'assign';
    const plazoValue = data.Plazo;
    const plazoStr = plazoValue instanceof Date && !isNaN(plazoValue)
      ? `${plazoValue.getFullYear()}-${(plazoValue.getMonth() + 1).toString().padStart(2, '0')}-${plazoValue.getDate().toString().padStart(2, '0')}`
      : '';
    const body = {
      action,
      title: data['Nombre Artículo'],
      link: data['Link Artículo'],
      rev1: data['Revisor 1'],
      rev2: data['Revisor 2'],
      editor: data.Editor,
      autor: data.Autor,
      plazo: plazoStr,
    };
    const articleKey = data['Nombre Artículo'] || data.Autor;
    setIsSending({ ...isSending, [articleKey]: true });
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Updated... please wait a few moments to see the change, please refresh the page.' });
      setEditingId(null);
      setEditingData(null);
    } catch (err) {
      setSubmitStatus({ ...submitStatus, [articleKey]: '❌ Error: ' + err.message });
    } finally {
      setIsSending({ ...isSending, [articleKey]: false });
    }
  };
  const handleContact = async (email, name, title, role, articleKey) => {
    if (!email || !name || !title || !role) {
      setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Missing data to send the reminder.` });
      return;
    }
    setIsSending({ ...isSending, [articleKey]: true });
    const englishRole = role === 'Revisor 1' ? 'Reviewer 1' : role === 'Revisor 2' ? 'Reviewer 2' : role === 'Editor' ? 'Section Editor' : role;
    const body = {
      action: 'sendReminder',
      email,
      name,
      title,
      role: englishRole,
      senderName: user?.Nombre || 'Editorial Team',
    };
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Reminder sent.' });
      const articleLink = pendingAssignments.find(a => sanitizeInput(a['Nombre Artículo']) === sanitizeInput(title))?.['Link Artículo'] || '';
      const htmlBody = `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
          <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="color: #f8f1e9; margin: 0;">Review Reminder</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${name},</p>
            <p>We are writing to kindly remind you that you have a pending review for the article <strong>${title}</strong> as <strong>${englishRole}</strong> for the <strong>National Review of Sciences for Students</strong>.</p>
            <p><strong>Article Link:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Open in Google Drive</a></p>
            <p><strong>Instructions:</strong></p>
            <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
              <li>Access the article via the provided link.</li>
              <li>Log in to <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">our portal</a> to review detailed instructions and submit your report, feedback, and vote.</li>
              <li>Please complete your review as soon as possible, as the deadline is approaching.</li>
            </ul>
            <p>If you need an extension or support, please contact us by replying to this email.</p>
            <p>Thank you for your valuable contribution to our journal.</p>
            <p>Sincerely,<br>${user?.Nombre || 'Editorial Team'}<br>Editor-in-Chief<br>National Review of Sciences for Students</p>
          </div>
          <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="font-size: 12px; color: #6b4e31; margin: 0;">We kindly ask that you respond to this email as soon as possible.</p>
          </div>
        </div>
      `;
      setEmailPreview({ to: email, subject: 'Reminder: Review Deadlines - National Review of Sciences for Students', htmlBody });
    } catch (err) {
      setSubmitStatus({ ...submitStatus, [articleKey]: `Error: ${err.message}` });
    } finally {
      setIsSending({ ...isSending, [articleKey]: false });
    }
  };
  const getUniqueId = (groupAuthor, artTitle) => {
    return `${sanitizeInput(groupAuthor)}-${sanitizeInput(artTitle || 'unnamed')}`;
  };
  const tutorialSteps = [
    '1. Explore the list of collaborators by clicking on their profiles to view descriptions, interests and contact them if they do not meet deadlines (use the "Contact" button for a professional email).',
    '2. In "Articles by Author", articles are grouped by author using the "Title of your paper". Only pending articles (without all feedback/reports) are shown.',
    '3. Click "Assign" for articles without assignment or "Edit" to update. Complete the fields (title, link, reviewers, editor, deadline) and confirm.',
    '4. Use the contact buttons to send institutional reminders by email from the server.',
    '5. The panel is responsive. Articles with all feedback are automatically hidden, regardless of the "Status".',
    '6. Use the calendar to view and edit deadlines for pending articles. Click on an event to edit the assignment.',
  ];
  const handleEditOrAssignClick = (group, art) => {
    const uniqueId = getUniqueId(group.authorName, art['Title of your paper'] || art['Título de su artículo']);
    const isAssigned = !!art.assignment;
    const defData = {
      nombre: isAssigned ? art.assignment['Nombre Artículo'] || art['Title of your paper'] || art['Título de su artículo'] || '' : art['Title of your paper'] || art['Título de su artículo'] || '',
      link: isAssigned ? art.assignment['Link Artículo'] || art[ARTICLE_LINK_COLUMN] || '' : art[ARTICLE_LINK_COLUMN] || '',
      r1: isAssigned ? art.assignment['Revisor 1'] || '' : '',
      r2: isAssigned ? art.assignment['Revisor 2'] || '' : '',
      editor: isAssigned ? art.assignment.Editor || '' : '',
      plazo: isAssigned ? (art.assignment.Plazo ? parseDate(art.assignment.Plazo) : null) : null,
    };
    setEditingData({
      id: uniqueId,
      data: defData,
      isUpdate: isAssigned,
      author: group.authorName,
      area: art['Area of the paper (e.g.: economics)'] || art['Área del artículo (e.g.: economía)'],
    });
    setEditingId(uniqueId);
  };
  const handleCancel = () => {
    setEditingId(null);
    setEditingData(null);
  };
  const handleConfirm = () => {
    const { data, isUpdate, author, area } = editingData;
    handleAssignOrUpdate(
      {
        'Nombre Artículo': data.nombre,
        'Link Artículo': data.link,
        'Revisor 1': data.r1,
        'Revisor 2': data.r2,
        Editor: data.editor,
        Autor: author,
        'Área del artículo': area,
        Plazo: data.plazo,
      },
      isUpdate
    );
  };
  const updateField = (field, value) => {
    setEditingData(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value }
    }));
  };
  if (loading) return <div className="text-center p-4 text-gray-600">Loading assignment management...</div>;
  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h2 className="font-serif text-2xl font-bold text-gray-900">Editorial Control Panel</h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-tight">Workflow and Collaborators Management</p>
          </div>
          <nav className="flex bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'articles', label: 'Articles', icon: '📝' },
              { id: 'collaborators', label: 'Team', icon: '👥' },
              { id: 'calendar', label: 'Deadlines', icon: '📅' },
              { id: 'spreadsheets', label: 'Spreadsheets', icon: '📊' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeView === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex space-x-2">
            <button
              onClick={() => setTutorialOpen(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Help
            </button>
            {onClose && (
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <MetricCard label="Total Articles" value={incoming.length} color="text-gray-900" />
          <MetricCard label="To Assign" value={incoming.filter(i => !allAssignments.some(a => {
            const aTitleSanitized = sanitizeInput(a['Nombre Artículo'] || '');
            const aAuthorSanitized = sanitizeInput(a.Autor || '');
            const titleSanitized = sanitizeInput(i['Title of your paper'] || i['Título de su artículo'] || '');
            const authorSanitized = sanitizeInput(i['Name (first name and last name)'] || i['Nombre (primer nombre y primer apellido)'] || '');
            const exactMatch = aTitleSanitized === titleSanitized && aAuthorSanitized === authorSanitized;
            const fuzzyTitleMatch = !exactMatch && (
              aTitleSanitized.includes(titleSanitized) ||
              titleSanitized.includes(aTitleSanitized)
            );
            return exactMatch || (fuzzyTitleMatch && aAuthorSanitized === authorSanitized);
          })).length} color="text-amber-600" />
          <MetricCard label="In Review" value={pendingAssignments.length} color="text-blue-600" />
          <MetricCard label="Active Reviewers" value={users.length} color="text-emerald-600" />
        </div>
        <AnimatePresence mode="wait">
          {activeView === 'articles' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-4">
                <h3 className="font-serif text-xl font-bold">Incoming Manuscripts ({totalPending})</h3>
                <div className="text-xs font-bold text-blue-600 cursor-pointer">Filter by Area ↓</div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {groupedIncoming.map((group) => (
                  <div key={group.authorName} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-300">
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      {/* Author Info */}
                      <div className="flex-none lg:w-1/4 border-r border-gray-50 pr-6">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold mb-3">
                          {group.authorName[0]}
                        </div>
                        <h4 className="font-bold text-gray-900 leading-tight">{group.authorName}</h4>
                        <p className="text-xs text-gray-500 mt-1 truncate">{group.authorEmail}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase mt-2 tracking-tighter italic">
                          {group.authorInstitution}
                        </p>
                      </div>
                      {/* Articles Info */}
                      <div className="flex-grow space-y-4">
                        {group.articles.map((art) => {
                          const uniqueId = getUniqueId(group.authorName, art['Title of your paper'] || art['Título de su artículo']);
                          const isAssigned = !!art.assignment;
                          const articleKey = art['Title of your paper'] || art['Título de su artículo'] || uniqueId;
                          const type = isAssigned ? 'assigned' : 'pending'; // TODO: Add overdue logic if needed
                          const docLink = art[ARTICLE_LINK_COLUMN] || '';
                          return (
                            <div key={uniqueId} className="flex items-start justify-between bg-gray-50/50 p-4 rounded-xl border border-transparent hover:border-gray-200 transition-colors">
                              <div className="max-w-xl">
                                <div className="flex items-center gap-3 mb-1">
                                  <StatusBadge type={type} />
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{art['Area of the paper (e.g.: economics)'] || art['Área del artículo (e.g.: economía)']}</span>
                                </div>
                                <h5 className="font-serif text-md font-bold text-gray-800 mb-2">{art['Title of your paper'] || art['Título de su artículo']}</h5>
                                <p className="text-[11px] text-gray-500 mb-2">{sanitizeInput(art['Abstract (150-300 words)'] || art['Abstract o resumen (150-300 palabras)']).substring(0, 150)}...</p>
                                {docLink && (
                                  <p className="text-[11px] text-gray-500 mb-2">
                                    <span className="font-bold">Document Link:</span> <a href={docLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View document</a>
                                  </p>
                                )}
                                {isAssigned && (
                                  <div className="flex gap-4 items-center">
                                    <div className="flex -space-x-2">
                                      {[1, 2].map(i => (
                                        <div key={i} title={`Reviewer ${i}`} className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold">
                                          {art.assignment[`Revisor ${i}`]?.[0] || '?'}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="h-4 w-[1px] bg-gray-200" />
                                    <p className="text-[11px] text-gray-500">
                                      <span className="font-bold">Deadline:</span> {art.assignment.Plazo || 'No date'}
                                    </p>
                                    <div className="h-4 w-[1px] bg-gray-200" />
                                    <p className="text-[11px] text-gray-500">
                                      <span className="font-bold">Editor:</span> {art.assignment.Editor || 'Unassigned'}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="self-center flex flex-col gap-2">
                                <button
                                  onClick={() => handleEditOrAssignClick(group, art)}
                                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-900 hover:text-white transition-all shadow-sm"
                                  disabled={isSending[articleKey]}
                                >
                                  {isSending[articleKey] ? 'Updating...' : (isAssigned ? 'Manage' : 'Assign Team')}
                                </button>
                                {isAssigned && (
                                  <div className="flex gap-2">
                                    {art.assignment['Revisor 1'] && (
                                      <button
                                        onClick={() => {
                                          const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 1']);
                                          if (reviewer) {
                                            handleContact(
                                              reviewer?.Correo || reviewer?.['Correo electrónico'],
                                              art.assignment['Revisor 1'],
                                              art['Title of your paper'] || art['Título de su artículo'],
                                              'Revisor 1',
                                              articleKey
                                            );
                                          }
                                        }}
                                        className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded text-[10px] font-bold hover:bg-yellow-100"
                                        disabled={isSending[articleKey]}
                                      >
                                        Contact R1
                                      </button>
                                    )}
                                    {art.assignment['Revisor 2'] && (
                                      <button
                                        onClick={() => {
                                          const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 2']);
                                          if (reviewer) {
                                            handleContact(
                                              reviewer?.Correo || reviewer?.['Correo electrónico'],
                                              art.assignment['Revisor 2'],
                                              art['Title of your paper'] || art['Título de su artículo'],
                                              'Revisor 2',
                                              articleKey
                                            );
                                          }
                                        }}
                                        className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded text-[10px] font-bold hover:bg-yellow-100"
                                        disabled={isSending[articleKey]}
                                      >
                                        Contact R2
                                      </button>
                                    )}
                                    {art.assignment.Editor && (
                                      <button
                                        onClick={() => {
                                          const editor = sectionEditors.find(e => e.Nombre === art.assignment.Editor);
                                          if (editor) {
                                            handleContact(
                                              editor?.Correo || editor?.['Correo electrónico'],
                                              art.assignment.Editor,
                                              art['Title of your paper'] || art['Título de su artículo'],
                                              'Editor',
                                              articleKey
                                            );
                                          }
                                        }}
                                        className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded text-[10px] font-bold hover:bg-yellow-100"
                                        disabled={isSending[articleKey]}
                                      >
                                        Contact Editor
                                      </button>
                                    )}
                                  </div>
                                )}
                                {submitStatus[articleKey] && (
                                  <span className={`text-[10px] ${submitStatus[articleKey].includes('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {submitStatus[articleKey]}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
          {activeView === 'collaborators' && (
            <motion.section
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {users.map((u) => {
                const userKey = u.Nombre;
                return (
                  <div key={u.Nombre} className="bg-white p-6 rounded-2xl border border-gray-100 text-center hover:shadow-lg transition-all group">
                    <div className="relative inline-block mb-4">
                      <img src={u.Imagen || 'https://via.placeholder.com/64?text=?'} className="w-20 h-20 rounded-full object-cover ring-4 ring-gray-50 group-hover:ring-blue-50 transition-all" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>
                    <h5 className="font-bold text-gray-900">{u.Nombre}</h5>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">{(u['Role in the Journal'] || u['Rol en la Revista'] || '').split(';')[0]}</p>
                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-around">
                      <button
                        onClick={() => handleContact(
                          u.Correo || u['Correo electrónico'],
                          u.Nombre,
                          'General',
                          (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Reviewer') || (u['Role in the Journal'] || u['Rol en la Revista'] || '').includes('Revisor') ? 'Reviewer' : 'Editor',
                          userKey
                        )}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        disabled={isSending[userKey]}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </button>
                      <button onClick={() => setSelectedUser(u)} className="text-gray-400 hover:text-blue-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </button>
                    </div>
                    {submitStatus[userKey] && (
                      <span className={`text-[10px] block mt-2 ${submitStatus[userKey].includes('Error') ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {submitStatus[userKey]}
                      </span>
                    )}
                  </div>
                );
              })}
            </motion.section>
          )}
          {activeView === 'calendar' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <CalendarComponent events={calendarEvents} onSelectEvent={handleSelectEvent} />
            </motion.div>
          )}
          {activeView === 'spreadsheets' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h3 className="font-serif text-xl font-bold">Spreadsheets</h3>
              <div className="space-y-6">
                <div>
                  <h5 className="font-medium text-md mb-2">Articles under review</h5>
                  <iframe src="https://docs.google.com/spreadsheets/d/1-M0Ca-3VmX-0t2M1uEVQsjEatzFFbxlfLlEXTUdp8ws/edit?usp=sharing" width="100%" height="600" frameborder="0"></iframe>
                </div>
                <div>
                  <h5 className="font-medium text-md mb-2">Spreadsheet 2</h5>
                  <iframe src="https://docs.google.com/spreadsheets/d/1sO6jANVLMzX409GkiIU5Z4g8G439ZjBVnquQUkPy1wE/edit?usp=sharing" width="100%" height="600" frameborder="0"></iframe>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      {/* ASSIGNMENT OVERLAY */}
      <AnimatePresence>
        {editingId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl p-10 overflow-y-auto"
            >
              <header className="mb-10">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.3em]">Assignment Editor</span>
                <h2 className="font-serif text-3xl font-bold text-gray-900 mt-2 leading-tight">{editingData.data.nombre}</h2>
                <p className="text-sm text-gray-500 mt-4 italic">"{editingData.area}"</p>
              </header>
              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Article Name</label>
                  <input
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                    value={editingData.data.nombre}
                    onChange={(e) => updateField('nombre', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Document Link</label>
                  <input
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                    value={editingData.data.link}
                    onChange={(e) => updateField('link', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Lead Reviewer (1)</label>
                    <select
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm"
                      value={editingData.data.r1}
                      onChange={(e) => updateField('r1', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {reviewers.map(r => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Peer Reviewer (2)</label>
                    <select
                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm"
                      value={editingData.data.r2}
                      onChange={(e) => updateField('r2', e.target.value)}
                    >
                      <option value="">Select...</option>
                      {reviewers.map(r => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Section Editor</label>
                  <select
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm"
                    value={editingData.data.editor}
                    onChange={(e) => updateField('editor', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {sectionEditors.map(e => <option key={e.Nombre} value={e.Nombre}>{e.Nombre}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Deadline Date</label>
                  <DatePicker
                    selected={editingData.data.plazo}
                    onChange={(date) => updateField('plazo', date)}
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm"
                    dateFormat="yyyy-MM-dd"
                  />
                </div>
                <div className="pt-10 flex gap-4">
                  <button
                    onClick={handleConfirm}
                    disabled={!editingData.data.nombre || !editingData.data.link || !editingData.data.r1 || !editingData.data.r2 || !editingData.data.editor || !editingData.data.plazo || isSending[editingData.id]}
                    className="flex-grow bg-gray-900 text-white py-4 rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg disabled:bg-gray-400"
                  >
                    {isSending[editingData.id] ? 'Updating...' : (editingData.isUpdate ? 'Update' : 'Assign')}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-6 py-4 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
                {submitStatus[editingData.id] && (
                  <span className={`text-sm block ${submitStatus[editingData.id].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {submitStatus[editingData.id]}
                  </span>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Selected User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h5 className="font-bold text-lg">{selectedUser.Nombre}</h5>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <p className="text-gray-700 mb-4 leading-relaxed">{selectedUser.Description || selectedUser.Descripción}</p>
            <p className="text-sm font-medium mb-4">
              <strong>Interests:</strong> {(selectedUser['Areas of interest'] || selectedUser['Áreas de interés'])?.split(';').map(i => i.trim()).join(', ') || 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Email:</strong> {selectedUser.Correo || selectedUser['Correo electrónico'] || 'N/A'}
            </p>
            <button
              onClick={() => handleContact(
                selectedUser.Correo || selectedUser['Correo electrónico'],
                selectedUser.Nombre,
                'General',
                (selectedUser['Role in the Journal'] || selectedUser['Rol en la Revista'] || '').includes('Reviewer') || (selectedUser['Role in the Journal'] || selectedUser['Rol en la Revista'] || '').includes('Revisor') ? 'Reviewer' : 'Editor',
                selectedUser.Nombre
              )}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
              disabled={isSending[selectedUser.Nombre]}
            >
              {isSending[selectedUser.Nombre] ? 'Sending email...' : 'Contact via Email (Sensitive Reminder)'}
            </button>
            {submitStatus[selectedUser.Nombre] && (
              <span className={`text-sm mt-2 block ${submitStatus[selectedUser.Nombre].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {submitStatus[selectedUser.Nombre]}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Tutorial Modal */}
      {tutorialOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h5 className="font-bold text-lg">Management Tutorial</h5>
              <button onClick={() => setTutorialOpen(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              {tutorialSteps.map((step, i) => <p key={i}>{step}</p>)}
            </div>
            <button
              onClick={() => setTutorialOpen(false)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Understood
            </button>
          </div>
        </div>
      )}
      {/* Email Preview Modal */}
      {emailPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h5 className="font-bold text-lg">Sent Email Preview</h5>
              <button onClick={() => setEmailPreview(null)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="mb-4">
              <p className="text-sm"><strong>To:</strong> {emailPreview.to}</p>
              <p className="text-sm"><strong>Subject:</strong> {emailPreview.subject}</p>
            </div>
            <div
              className="border p-4 rounded bg-gray-50"
              dangerouslySetInnerHTML={{ __html: emailPreview.htmlBody }}
            />
            <button
              onClick={() => setEmailPreview(null)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}