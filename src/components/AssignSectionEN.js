import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const INCOMING_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJx5loBW2UoEAhkdkkjad7VQxtjBJKtZT8ZIBMd0NGdAZH7Z2hKNczn1OrTHZRrBzI5_mQRHzxYxHS/pub?gid=1161174444&single=true&output=csv';
const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';

const sanitizeInput = (input) => input ? input.trim().toLowerCase().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : '';

export default function AssignSection({ user, onClose }) {
  const [users, setUsers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [sectionEditors, setSectionEditors] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({});
  const [isSending, setIsSending] = useState({});
  const [emailPreview, setEmailPreview] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("📡 Iniciando fetch de CSVs...");

        const [usersText, incomingText, assignmentsText] = await Promise.all([
          fetch(USERS_CSV, { cache: 'no-store' }).then(r => r.text()),
          fetch(INCOMING_CSV, { cache: 'no-store' }).then(r => r.text()),
          fetch(ASSIGNMENTS_CSV, { cache: 'no-store' }).then(r => r.text()),
        ]);

        console.log("✅ CSVs descargados");

        const parsedUsers = Papa.parse(usersText, { header: true, skipEmptyLines: true }).data.filter(u => u.Nombre && u.Nombre.trim());
        console.log("👥 Usuarios parseados:", parsedUsers);

        const filteredUsers = parsedUsers.filter(u => {
          const roles = (u['Rol en la Revista'] || '').split(';').map(r => r.trim()).filter(Boolean);
          return roles.some(r => r === 'Revisor' || r === 'Editor de Sección' || r === 'Editor en Jefe');
        });
        setUsers(filteredUsers);
        console.log("✅ Usuarios filtrados (revisores + editores + editores en jefe):", filteredUsers);

        const revs = filteredUsers.filter(u => (u['Rol en la Revista'] || '').includes('Revisor'));
        const eds = filteredUsers.filter(u => (u['Rol en la Revista'] || '').includes('Editor de Sección'));
        const chiefs = filteredUsers.filter(u => (u['Rol en la Revista'] || '').includes('Editor en Jefe'));
        setReviewers(revs);
        setSectionEditors([...eds, ...chiefs]);
        console.log("👤 Revisores:", revs);
        console.log("📂 Editores (incluyendo en jefe):", [...eds, ...chiefs]);

        const parsedIncoming = Papa.parse(incomingText, { header: true, skipEmptyLines: true }).data.filter(i => 
          i['Nombre (primer nombre y primer apellido)'] && 
          i['Título de su artículo'] && 
          i['Nombre (primer nombre y primer apellido)'].trim() && 
          i['Título de su artículo'].trim()
        );
        setIncoming(parsedIncoming);
        console.log("📝 Artículos entrantes:", parsedIncoming);

        const parsedAssignments = Papa.parse(assignmentsText, { header: true, skipEmptyLines: true }).data.filter(a => 
          a['Nombre Artículo'] && a['Nombre Artículo'].trim() && a.Autor && a.Autor.trim()
        );
        const isCompleted = (assign) => {
          return !!(assign['Feedback 1'] && assign['Informe 1'] && assign['Feedback 2'] && assign['Informe 2'] && assign['Feedback 3'] && assign['Informe 3']);
        };
        const pendingAssignments = parsedAssignments.filter(a => !isCompleted(a));
        setAssignments(pendingAssignments);

        console.log("📂 Asignaciones pendientes:", pendingAssignments);
      } catch (err) {
        console.error('❌ Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isCompleted = (assign) => {
    return !!(assign['Feedback 1'] && assign['Informe 1'] && assign['Feedback 2'] && assign['Informe 2'] && assign['Feedback 3'] && assign['Informe 3']);
  };

  const groupedIncoming = useMemo(() => {
    const groupMap = {};
    incoming.forEach(art => {
      const authorSanitized = sanitizeInput(art['Nombre (primer nombre y primer apellido)'] || '');
      const titleSanitized = sanitizeInput(art['Título de su artículo'] || '');
      if (!groupMap[authorSanitized]) {
        groupMap[authorSanitized] = [];
      }
      let matchingAssign = assignments.find(a => {
        const aTitleSanitized = sanitizeInput(a['Nombre Artículo'] || '');
        const aAuthorSanitized = sanitizeInput(a.Autor || '');
        const exactMatch = aTitleSanitized === titleSanitized && aAuthorSanitized === authorSanitized;
        const fuzzyTitleMatch = !exactMatch && (
          aTitleSanitized.includes(titleSanitized) || 
          titleSanitized.includes(aTitleSanitized)
        );
        return exactMatch || (fuzzyTitleMatch && aAuthorSanitized === authorSanitized);
      });
      groupMap[authorSanitized].push({ ...art, assignment: matchingAssign });
    });
    return Object.entries(groupMap).map(([sanitizedAuthor, articles]) => ({
      authorName: articles[0]['Nombre (primer nombre y primer apellido)'],
      authorEmail: articles[0]['Correo electrónico'],
      authorInstitution: articles[0]['Establecimiento educacional'],
      articles,
    }));
  }, [incoming, assignments]);

  const totalPending = groupedIncoming.reduce((sum, group) => {
    return sum + group.articles.filter(art => !(art.assignment && isCompleted(art.assignment))).length;
  }, 0);

  const handleAssignOrUpdate = async (data, isUpdate = false) => {
    const action = isUpdate ? 'update' : 'assign';
    const body = {
      action,
      title: data['Nombre Artículo'],
      link: data['Link Artículo'],
      rev1: data['Revisor 1'],
      rev2: data['Revisor 2'],
      editor: data.Editor,
      autor: data.Autor,
    };
    const articleKey = data['Nombre Artículo'] || data.Autor;

    console.log("📤 Enviando datos al script:", body);
    setIsSending({ ...isSending, [articleKey]: true });

    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log("📨 Fetch enviado, response (no-cors, no se puede leer):", response);
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Changed... please wait a moment to see the update, then refresh the page.' });
      setEditingId(null);
      setEditingData(null);
    } catch (err) {
      setSubmitStatus({ ...submitStatus, [articleKey]: '❌ Error: ' + err.message });
      console.error('Error submitting:', err);
    } finally {
      setIsSending({ ...isSending, [articleKey]: false });
    }
  };

  const handleContact = async (email, name, title, role, articleKey) => {
    console.log("📧 Sending reminder request for:", { email, name, title, role, articleKey });

    if (!email || !name || !title || !role) {
      console.error("Missing email, name, title, or role:", { email, name, title, role });
      setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Missing data to send the reminder.` });
      return;
    }

    setIsSending({ ...isSending, [articleKey]: true });

    const body = {
      action: 'sendReminder',
      email,
      name,
      title,
      role,
      senderName: user?.Nombre || 'Editorial Team',
    };

    console.log("📤 Enviando datos al script:", body);

    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log("📨 Fetch enviado (no-cors, no se puede leer la respuesta):", response);
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Reminder sent.' });

      const articleLink = assignments.find(a => sanitizeInput(a['Nombre Artículo']) === sanitizeInput(title))?.['Link Artículo'] || '';
      const htmlBody = `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
          <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="color: #f8f1e9; margin: 0;">Review Reminder</h2>
          </div>
          <div style="padding: 20px;">
            <p>Dear ${name},</p>
            <p>We are writing to kindly remind you that you have a pending review for the article <strong>${title}</strong> as <strong>${role}</strong> for the <strong>National Journal of Student Sciences</strong>.</p>
            <p><strong>Article Link:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Open in Google Drive</a></p>
            <p><strong>Instructions:</strong></p>
            <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
              <li>Access the article via the provided link.</li>
              <li>Log in to <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">our portal</a> to review detailed instructions and submit your report, feedback, and vote.</li>
              <li>Please complete your review as soon as possible, as the deadline is approaching.</li>
            </ul>
            <p>If you need an extension or support, please contact us by replying to this email.</p>
            <p>Thank you for your valuable contribution to our journal.</p>
            <p>Sincerely,<br>${user?.Nombre || 'Editorial Team'}<br>Editor-in-Chief<br>National Journal of Student Sciences</p>
          </div>
          <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="font-size: 12px; color: #6b4e31; margin: 0;">We kindly ask that you respond to this email as soon as possible if you are able.</p>
          </div>
        </div>
      `;
      setEmailPreview({ to: email, subject: 'Reminder: Review Deadlines - National Journal of Student Sciences', htmlBody });
    } catch (err) {
      console.error("Error enviando recordatorio:", err);
      setSubmitStatus({ ...submitStatus, [articleKey]: `Error: ${err.message}` });
    } finally {
      setIsSending({ ...isSending, [articleKey]: false });
    }
  };

  const handleContactEditor = (art) => {
    console.log("Clicking Contactar Editor for:", art.assignment.Editor);
    const editor = sectionEditors.find(e => e.Nombre === art.assignment.Editor);
    if (!editor) {
      console.error("Editor not found:", art.assignment.Editor);
      setSubmitStatus({ ...submitStatus, [art['Título de su artículo']]: `Error: Editor (${art.assignment.Editor}) not found.` });
      return;
    }
    handleContact(
      editor?.Correo || editor?.['Correo electrónico'],
      art.assignment.Editor,
      art['Título de su artículo'],
      'Editor',
      art['Título de su artículo']
    );
  };

  const getUniqueId = (groupAuthor, artTitle) => {
    return `${sanitizeInput(groupAuthor)}-${sanitizeInput(artTitle || 'unnamed')}`;
  };

  const tutorialSteps = [
    '1. Explore the list of collaborators by clicking on their profiles to view descriptions, interests, and contact them if they miss deadlines (use the "Contact" button for a professional email).',
    '2. In "Articles by Author," articles are grouped by author using the "Article Title." Only pending articles (without all feedback/reports) are shown.',
    '3. Click "Assign" for unassigned articles or "Edit" to update. Complete the fields (title, link, reviewers, editor) and confirm.',
    '4. Use the contact buttons to send institutional email reminders from the server.',
    '5. The panel is responsive. Articles with all feedback are automatically hidden, regardless of "Status."',
  ];

  if (loading) return <div className="text-center p-4 text-gray-600">Loading assignment management...</div>;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6 overflow-hidden">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Assignment Management</h3>
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

      <section>
        <h4 className="text-lg font-semibold mb-4">Collaborators (Reviewers and Section Editors)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users.map((u) => (
            <div
              key={u.Nombre}
              className="bg-gray-50 p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-200 flex flex-col items-center text-center h-full"
              onClick={() => setSelectedUser(u)}
            >
              <img
                src={u.Imagen || 'https://via.placeholder.com/64?text=?'} 
                alt={u.Nombre}
                className="w-16 h-16 rounded-full mb-2 object-cover"
              />
              <h5 className="font-medium text-sm">{u.Nombre}</h5>
              <p className="text-xs text-gray-600">{(u['Rol en la Revista'] || '').split(';')[0].trim()}</p>
            </div>
          ))}
        </div>
      </section>

      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h5 className="font-bold text-lg">{selectedUser.Nombre}</h5>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <p className="text-gray-700 mb-4 leading-relaxed">{selectedUser.Descripción}</p>
            <p className="text-sm font-medium mb-4">
              <strong>Interests:</strong> {selectedUser['Áreas de interés']?.split(';').map(i => i.trim()).join(', ') || 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Email:</strong> {selectedUser.Correo || selectedUser['Correo electrónico'] || 'N/A'}
            </p>
            <button
              onClick={() => handleContact(
                selectedUser.Correo || selectedUser['Correo electrónico'],
                selectedUser.Nombre,
                'General',
                (selectedUser['Rol en la Revista'] || '').includes('Revisor') ? 'Reviewer' : 'Editor',
                selectedUser.Nombre
              )}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
              disabled={isSending[selectedUser.Nombre]}
            >
              {isSending[selectedUser.Nombre] ? 'Sending email...' : 'Contact by Email (Sensitive Reminder)'}
            </button>
            {submitStatus[selectedUser.Nombre] && (
              <span className={`text-sm mt-2 block ${submitStatus[selectedUser.Nombre].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {submitStatus[selectedUser.Nombre]}
              </span>
            )}
          </div>
        </div>
      )}

      <section>
        <h4 className="text-lg font-semibold mb-4">Articles by Author ({totalPending})</h4>
        <div className="space-y-6">
          {groupedIncoming.map((group) => (
            <div key={group.authorName} className="bg-gray-50 p-4 rounded-lg border">
              <div className="mb-4 p-3 bg-white rounded border">
                <h5 className="font-medium text-lg">{group.authorName}</h5>
                <p className="text-sm text-gray-600">Email: {group.authorEmail}</p>
                <p className="text-sm text-gray-600">Institution: {group.authorInstitution}</p>
              </div>
              <div className="space-y-4">
                {group.articles
                  .filter(art => !(art.assignment && isCompleted(art.assignment)))
                  .map((art) => {
                    const uniqueId = getUniqueId(group.authorName, art['Título de su artículo']);
                    const isAssigned = !!art.assignment;
                    const isEditingThis = editingId === uniqueId;
                    const currentR1 = isAssigned ? art.assignment['Revisor 1'] || 'Not assigned' : 'Not assigned';
                    const currentR2 = isAssigned ? art.assignment['Revisor 2'] || 'Not assigned' : 'Not assigned';
                    const currentEditor = isAssigned ? art.assignment.Editor || 'Not assigned' : 'Not assigned';
                    const statusBadge = isAssigned ? 'Assigned (in review)' : 'Pending assignment';
                    const badgeClass = isAssigned ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';

                    const handleEditOrAssignClick = () => {
                      const defData = {
                        nombre: isAssigned ? art.assignment['Nombre Artículo'] || art['Título de su artículo'] || '' : art['Título de su artículo'] || '',
                        link: isAssigned ? art.assignment['Link Artículo'] || art['Inserta aquí tu artículo en formato Word. Debe tener de 2.000 a 10.000 palabras.'] || '' : art['Inserta aquí tu artículo en formato Word. Debe tener de 2.000 a 10.000 palabras.'] || '',
                        r1: isAssigned ? art.assignment['Revisor 1'] || '' : '',
                        r2: isAssigned ? art.assignment['Revisor 2'] || '' : '',
                        editor: isAssigned ? art.assignment.Editor || '' : '',
                      };
                      setEditingData({
                        id: uniqueId,
                        data: defData,
                        isUpdate: isAssigned,
                        author: group.authorName,
                        area: art['Área del artículo (e.g.: economía)'],
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

                    const articleKey = art['Título de su artículo'] || uniqueId;

                    return (
                      <div key={uniqueId} className="bg-white p-4 rounded-lg border mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h6 className="font-medium">{art['Título de su artículo'] || 'No title'}</h6>
                            <p className="text-sm text-gray-600"><strong>Area:</strong> {art['Área del artículo (e.g.: economía)']}</p>
                          </div>
                          <div>
                            <p className="text-sm"><strong>Abstract:</strong> {sanitizeInput(art['Abstract o resumen (150-300 palabras)']).substring(0, 150)}...</p>
                          </div>
                        </div>
                        <div className="mb-4 space-y-1 text-sm">
                          <p><strong>Reviewer 1:</strong> {currentR1}</p>
                          <p><strong>Reviewer 2:</strong> {currentR2}</p>
                          <p><strong>Editor:</strong> {currentEditor}</p>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${badgeClass}`}>
                            {statusBadge}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <button
                            onClick={handleEditOrAssignClick}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            disabled={isSending[articleKey]}
                          >
                            {isSending[articleKey] ? 'Updating...' : (isAssigned ? 'Edit' : 'Assign')}
                          </button>
                          {isAssigned && art.assignment['Revisor 1'] && (
                            <button
                              onClick={() => {
                                console.log("Clicking Contactar R1 for:", art.assignment['Revisor 1']);
                                const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 1']);
                                if (!reviewer) {
                                  console.error("Reviewer not found:", art.assignment['Revisor 1']);
                                  setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Reviewer 1 (${art.assignment['Revisor 1']}) not found.` });
                                  return;
                                }
                                handleContact(
                                  reviewer?.Correo || reviewer?.['Correo electrónico'],
                                  art.assignment['Revisor 1'],
                                  art['Título de su artículo'],
                                  'Reviewer 1',
                                  articleKey
                                );
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                              disabled={isSending[articleKey]}
                            >
                              {isSending[articleKey] ? 'Sending email...' : 'Contact R1'}
                            </button>
                          )}
                          {isAssigned && art.assignment['Revisor 2'] && (
                            <button
                              onClick={() => {
                                console.log("Clicking Contactar R2 for:", art.assignment['Revisor 2']);
                                const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 2']);
                                if (!reviewer) {
                                  console.error("Reviewer not found:", art.assignment['Revisor 2']);
                                  setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Reviewer 2 (${art.assignment['Revisor 2']}) not found.` });
                                  return;
                                }
                                handleContact(
                                  reviewer?.Correo || reviewer?.['Correo electrónico'],
                                  art.assignment['Revisor 2'],
                                  art['Título de su artículo'],
                                  'Reviewer 2',
                                  articleKey
                                );
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                              disabled={isSending[articleKey]}
                            >
                              {isSending[articleKey] ? 'Sending email...' : 'Contact R2'}
                            </button>
                          )}
                          {isAssigned && art.assignment.Editor && (
                            <button
                              onClick={() => {
                                console.log("Clicking Contactar Editor for:", art.assignment.Editor);
                                const editor = sectionEditors.find(e => e.Nombre === art.assignment.Editor);
                                if (!editor) {
                                  console.error("Editor not found:", art.assignment.Editor);
                                  setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Editor (${art.assignment.Editor}) not found.` });
                                  return;
                                }
                                handleContact(
                                  editor?.Correo || editor?.['Correo electrónico'],
                                  art.assignment.Editor,
                                  art['Título de su artículo'],
                                  'Editor',
                                  articleKey
                                );
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                              disabled={isSending[articleKey]}
                            >
                              {isSending[articleKey] ? 'Sending email...' : 'Contact Editor'}
                            </button>
                          )}
                          {submitStatus[articleKey] && (
                            <span className={`text-sm mt-2 block ${submitStatus[articleKey].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                              {submitStatus[articleKey]}
                            </span>
                          )}
                        </div>
                        {isEditingThis && (
                          <div className="p-4 bg-gray-100 rounded border">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                              <input
                                placeholder="Article Title"
                                value={editingData.data.nombre}
                                onChange={(e) => updateField('nombre', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              />
                              <input
                                placeholder="Google Drive Link"
                                value={editingData.data.link}
                                onChange={(e) => updateField('link', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              />
                              <select
                                value={editingData.data.r1}
                                onChange={(e) => updateField('r1', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              >
                                <option value="">Select Reviewer 1</option>
                                {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                              </select>
                              <select
                                value={editingData.data.r2}
                                onChange={(e) => updateField('r2', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              >
                                <option value="">Select Reviewer 2</option>
                                {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                              </select>
                              <select
                                value={editingData.data.editor}
                                onChange={(e) => updateField('editor', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              >
                                <option value="">Select Editor</option>
                                {sectionEditors.map((e) => <option key={e.Nombre} value={e.Nombre}>{e.Nombre}</option>)}
                              </select>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={handleConfirm}
                                disabled={!editingData.data.nombre || !editingData.data.link || !editingData.data.r1 || !editingData.data.r2 || !editingData.data.editor || isSending[articleKey]}
                                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                              >
                                {isSending[articleKey] ? 'Updating...' : (editingData.isUpdate ? 'Update' : 'Assign')}
                              </button>
                              <button
                                onClick={handleCancel}
                                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                            {submitStatus[articleKey] && (
                              <span className={`text-sm mt-2 block ${submitStatus[articleKey].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                                {submitStatus[articleKey]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

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