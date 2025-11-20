import React, { useState, useEffect, useMemo } from 'react';
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
  const parts = dateStr.split(/[-\/]/); // Maneja / o -
  if (parts.length !== 3) return null;
  let year, month, day;
  if (parts[0].length === 4) { // YYYY-MM-DD
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    // Try DD/MM/YYYY first
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
    if (month > 12 || day > 31 || month < 1 || day < 1 || isNaN(year) || isNaN(month) || isNaN(day)) {
      // Try MM/DD/YYYY
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (month > 12 || day > 31 || month < 1 || day < 1 || isNaN(year) || isNaN(month) || isNaN(day)) {
        console.warn('Invalid date parsed:', dateStr);
        return null;
      }
    }
    month -= 1; // Adjust for JS Date
  }
  return new Date(year, month, day);
};

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
  const [selectedEvent, setSelectedEvent] = useState(null);

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
        setReviewers([...revs, ...eds, ...chiefs]);
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

  const calendarEvents = useMemo(() => {
    return assignments
      .filter(a => a.Plazo && parseDate(a.Plazo))
      .map(a => ({
        title: a['Nombre Artículo'],
        start: parseDate(a.Plazo),
        end: parseDate(a.Plazo),
        allDay: true,
        resource: a,
      }));
  }, [assignments]);

  const handleSelectEvent = (event) => {
    const assignment = event.resource;
    const titleSanitized = sanitizeInput(assignment['Nombre Artículo']);
    const authorSanitized = sanitizeInput(assignment.Autor);
    // Find the group and art
    for (const group of groupedIncoming) {
      if (sanitizeInput(group.authorName) === authorSanitized) {
        const art = group.articles.find(a => sanitizeInput(a['Título de su artículo'] || '') === titleSanitized);
        if (art) {
          const uniqueId = getUniqueId(group.authorName, art['Título de su artículo']);
          const defData = {
            nombre: assignment['Nombre Artículo'] || art['Título de su artículo'] || '',
            link: assignment['Link Artículo'] || art['Inserta aquí tu artículo en formato Word. Debe tener de 1.000 a 10.000 palabras.'] || '',
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
            area: art['Área del artículo (e.g.: economía)'],
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
    const plazoStr = plazoValue instanceof Date && !isNaN(plazoValue) ? plazoValue.toISOString().split('T')[0] : '';
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
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Cambiado... espere unos momentos para ver el cambio, por favor reinicie la página.' });
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
      setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Faltan datos para enviar el recordatorio.` });
      return;
    }
    setIsSending({ ...isSending, [articleKey]: true });
    const body = {
      action: 'sendReminder',
      email,
      name,
      title,
      role,
      senderName: user?.Nombre || 'Equipo Editorial',
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
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Recordatorio enviado.' });
      const articleLink = assignments.find(a => sanitizeInput(a['Nombre Artículo']) === sanitizeInput(title))?.['Link Artículo'] || '';
      const htmlBody = `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
          <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="color: #f8f1e9; margin: 0;">Recordatorio de Revisión</h2>
          </div>
          <div style="padding: 20px;">
            <p>Estimado/a ${name},</p>
            <p>Le escribimos para recordarle amablemente que tiene pendiente la revisión del artículo <strong>${title}</strong> como <strong>${role}</strong> en la <strong>Revista Nacional de las Ciencias para Estudiantes</strong>.</p>
            <p><strong>Enlace al artículo:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Abrir en Google Drive</a></p>
            <p><strong>Instrucciones:</strong></p>
            <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
              <li>Accede al artículo mediante el enlace proporcionado.</li>
              <li>Inicia sesión en <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">nuestro portal</a> para revisar las instrucciones detalladas y dejar tu informe, retroalimentación y voto.</li>
              <li>Por favor, completa tu revisión lo antes posible, ya que el plazo está próximo a vencer.</li>
            </ul>
            <p>Si necesita alguna extensión o apoyo, contáctenos respondiendo a este correo.</p>
            <p>Gracias por su valiosa contribución a nuestra revista.</p>
            <p>Atentamente,<br>${user?.Nombre || 'Equipo Editorial'}<br>Editor en Jefe<br>Revista Nacional de las Ciencias para Estudiantes</p>
          </div>
          <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="font-size: 12px; color: #6b4e31; margin: 0;">Le pedimos amablemente que responda cuanto antes este correo si le es posible.</p>
          </div>
        </div>
      `;
      setEmailPreview({ to: email, subject: 'Recordatorio: Plazos de Revisión - Revista Nacional de las Ciencias para Estudiantes', htmlBody });
    } catch (err) {
      console.error("Error enviando recordatorio:", err);
      setSubmitStatus({ ...submitStatus, [articleKey]: `Error: ${err.message}` });
    } finally {
      setIsSending({ ...isSending, [articleKey]: false });
    }
  };

  const getUniqueId = (groupAuthor, artTitle) => {
    return `${sanitizeInput(groupAuthor)}-${sanitizeInput(artTitle || 'unnamed')}`;
  };

  const tutorialSteps = [
    '1. Explora la lista de colaboradores haciendo clic en sus perfiles para ver descripciones, intereses y contactarlos si no cumplen plazos (usa el botón "Contactar" para un email profesional).',
    '2. En "Artículos por Autor", los artículos se agrupan por autor usando el "Título de su artículo". Se muestran solo los pendientes (sin todas las retroalimentaciones/informes).',
    '3. Haz clic en "Asignar" para artículos sin asignación o "Editar" para actualizar. Completa los campos (título, link, revisores, editor, plazo) y confirma.',
    '4. Usa los botones de contacto para enviar recordatorios institucionales por correo desde el servidor.',
    '5. El panel es responsive. Los artículos con todas las retroalimentaciones se ocultan automáticamente, independientemente del "Estado".',
    '6. Usa el calendario para ver y editar plazos de artículos pendientes. Haz clic en un evento para editar la asignación.',
  ];

  if (loading) return <div className="text-center p-4 text-gray-600">Cargando gestión de asignaciones...</div>;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6 overflow-hidden">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Gestión de Asignaciones</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setTutorialOpen(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Ayuda
          </button>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
          )}
        </div>
      </div>
      <CalendarComponent events={calendarEvents} onSelectEvent={handleSelectEvent} />
      <section>
        <h4 className="text-lg font-semibold mb-4">Colaboradores (Revisores y Editores de Sección)</h4>
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
              <strong>Intereses:</strong> {selectedUser['Áreas de interés']?.split(';').map(i => i.trim()).join(', ') || 'N/A'}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Correo:</strong> {selectedUser.Correo || selectedUser['Correo electrónico'] || 'N/A'}
            </p>
            <button
              onClick={() => handleContact(
                selectedUser.Correo || selectedUser['Correo electrónico'],
                selectedUser.Nombre,
                'General',
                (selectedUser['Rol en la Revista'] || '').includes('Revisor') ? 'Revisor' : 'Editor',
                selectedUser.Nombre
              )}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
              disabled={isSending[selectedUser.Nombre]}
            >
              {isSending[selectedUser.Nombre] ? 'Enviando correo...' : 'Contactar por Email (Recordatorio Sensible)'}
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
        <h4 className="text-lg font-semibold mb-4">Artículos por Autor ({totalPending})</h4>
        <div className="space-y-6">
          {groupedIncoming.map((group) => (
            <div key={group.authorName} className="bg-gray-50 p-4 rounded-lg border">
              <div className="mb-4 p-3 bg-white rounded border">
                <h5 className="font-medium text-lg">{group.authorName}</h5>
                <p className="text-sm text-gray-600">Correo: {group.authorEmail}</p>
                <p className="text-sm text-gray-600">Institución: {group.authorInstitution}</p>
              </div>
              <div className="space-y-4">
                {group.articles
                  .filter(art => !(art.assignment && isCompleted(art.assignment)))
                  .map((art) => {
                    const uniqueId = getUniqueId(group.authorName, art['Título de su artículo']);
                    const isAssigned = !!art.assignment;
                    const isEditingThis = editingId === uniqueId;
                    const currentR1 = isAssigned ? art.assignment['Revisor 1'] || 'No asignado' : 'No asignado';
                    const currentR2 = isAssigned ? art.assignment['Revisor 2'] || 'No asignado' : 'No asignado';
                    const currentEditor = isAssigned ? art.assignment.Editor || 'No asignado' : 'No asignado';
                    const currentPlazo = isAssigned ? art.assignment.Plazo || 'No definido' : 'No definido';
                    const statusBadge = isAssigned ? 'Asignado (en revisión)' : 'Pendiente de asignar';
                    const badgeClass = isAssigned ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
                    const handleEditOrAssignClick = () => {
                      const defData = {
                        nombre: isAssigned ? art.assignment['Nombre Artículo'] || art['Título de su artículo'] || '' : art['Título de su artículo'] || '',
                        link: isAssigned ? art.assignment['Link Artículo'] || art['Inserta aquí tu artículo en formato Word. Debe tener de 1.000 a 10.000 palabras.'] || '' : art['Inserta aquí tu artículo en formato Word. Debe tener de 1.000 a 10.000 palabras.'] || '',
                        r1: isAssigned ? art.assignment['Revisor 1'] || '' : '',
                        r2: isAssigned ? art.assignment['Revisor 2'] || '' : '',
                        editor: isAssigned ? art.assignment.Editor || '' : '',
                        plazo: isAssigned ? (art.assignment.Plazo ? parseDate(art.assignment.Plazo) : null) : null,
                      };
                      console.log('Loading plazo:', art.assignment?.Plazo, defData.plazo); // Added log for debug
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
                    const articleKey = art['Título de su artículo'] || uniqueId;
                    return (
                      <div key={uniqueId} className="bg-white p-4 rounded-lg border mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h6 className="font-medium">{art['Título de su artículo'] || 'Sin título'}</h6>
                            <p className="text-sm text-gray-600"><strong>Área:</strong> {art['Área del artículo (e.g.: economía)']}</p>
                          </div>
                          <div>
                            <p className="text-sm"><strong>Resumen:</strong> {sanitizeInput(art['Abstract o resumen (150-300 palabras)']).substring(0, 150)}...</p>
                          </div>
                        </div>
                        <div className="mb-4 space-y-1 text-sm">
                          <p><strong>Revisor 1:</strong> {currentR1}</p>
                          <p><strong>Revisor 2:</strong> {currentR2}</p>
                          <p><strong>Editor:</strong> {currentEditor}</p>
                          <p><strong>Plazo:</strong> {currentPlazo}</p>
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
                            {isSending[articleKey] ? 'Cambiando...' : (isAssigned ? 'Editar' : 'Asignar')}
                          </button>
                          {isAssigned && art.assignment['Revisor 1'] && (
                            <button
                              onClick={() => {
                                console.log("Clicking Contactar R1 for:", art.assignment['Revisor 1']);
                                const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 1']);
                                if (!reviewer) {
                                  console.error("Reviewer not found:", art.assignment['Revisor 1']);
                                  setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Revisor 1 (${art.assignment['Revisor 1']}) no encontrado.` });
                                  return;
                                }
                                handleContact(
                                  reviewer?.Correo || reviewer?.['Correo electrónico'],
                                  art.assignment['Revisor 1'],
                                  art['Título de su artículo'],
                                  'Revisor 1',
                                  articleKey
                                );
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                              disabled={isSending[articleKey]}
                            >
                              {isSending[articleKey] ? 'Enviando correo...' : 'Contactar R1'}
                            </button>
                          )}
                          {isAssigned && art.assignment['Revisor 2'] && (
                            <button
                              onClick={() => {
                                console.log("Clicking Contactar R2 for:", art.assignment['Revisor 2']);
                                const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 2']);
                                if (!reviewer) {
                                  console.error("Reviewer not found:", art.assignment['Revisor 2']);
                                  setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Revisor 2 (${art.assignment['Revisor 2']}) no encontrado.` });
                                  return;
                                }
                                handleContact(
                                  reviewer?.Correo || reviewer?.['Correo electrónico'],
                                  art.assignment['Revisor 2'],
                                  art['Título de su artículo'],
                                  'Revisor 2',
                                  articleKey
                                );
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                              disabled={isSending[articleKey]}
                            >
                              {isSending[articleKey] ? 'Enviando correo...' : 'Contactar R2'}
                            </button>
                          )}
                          {isAssigned && art.assignment.Editor && (
                            <button
                              onClick={() => {
                                console.log("Clicking Contactar Editor for:", art.assignment.Editor);
                                const editor = sectionEditors.find(e => e.Nombre === art.assignment.Editor);
                                if (!editor) {
                                  console.error("Editor not found:", art.assignment.Editor);
                                  setSubmitStatus({ ...submitStatus, [articleKey]: `Error: Editor (${art.assignment.Editor}) no encontrado.` });
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
                              {isSending[articleKey] ? 'Enviando correo...' : 'Contactar Editor'}
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
                                placeholder="Nombre del Artículo"
                                value={editingData.data.nombre}
                                onChange={(e) => updateField('nombre', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              />
                              <input
                                placeholder="Link de Google Drive"
                                value={editingData.data.link}
                                onChange={(e) => updateField('link', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              />
                              <select
                                value={editingData.data.r1}
                                onChange={(e) => updateField('r1', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              >
                                <option value="">Seleccionar Revisor 1</option>
                                {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                              </select>
                              <select
                                value={editingData.data.r2}
                                onChange={(e) => updateField('r2', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              >
                                <option value="">Seleccionar Revisor 2</option>
                                {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                              </select>
                              <select
                                value={editingData.data.editor}
                                onChange={(e) => updateField('editor', e.target.value)}
                                className="border p-2 rounded-md text-sm"
                              >
                                <option value="">Seleccionar Editor</option>
                                {sectionEditors.map((e) => <option key={e.Nombre} value={e.Nombre}>{e.Nombre}</option>)}
                              </select>
                              <DatePicker
                                selected={editingData.data.plazo}
                                onChange={(date) => updateField('plazo', date)}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="Seleccionar Plazo"
                                className="border p-2 rounded-md text-sm w-full"
                              />
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={handleConfirm}
                                disabled={!editingData.data.nombre || !editingData.data.link || !editingData.data.r1 || !editingData.data.r2 || !editingData.data.editor || !editingData.data.plazo || isSending[articleKey]}
                                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                              >
                                {isSending[articleKey] ? 'Cambiando...' : (editingData.isUpdate ? 'Actualizar' : 'Asignar')}
                              </button>
                              <button
                                onClick={handleCancel}
                                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 text-sm"
                              >
                                Cancelar
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
              <h5 className="font-bold text-lg">Tutorial de Gestión</h5>
              <button onClick={() => setTutorialOpen(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              {tutorialSteps.map((step, i) => <p key={i}>{step}</p>)}
            </div>
            <button
              onClick={() => setTutorialOpen(false)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {emailPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h5 className="font-bold text-lg">Previsualización del Correo Enviado</h5>
              <button onClick={() => setEmailPreview(null)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="mb-4">
              <p className="text-sm"><strong>Para:</strong> {emailPreview.to}</p>
              <p className="text-sm"><strong>Asunto:</strong> {emailPreview.subject}</p>
            </div>
            <div
              className="border p-4 rounded bg-gray-50"
              dangerouslySetInnerHTML={{ __html: emailPreview.htmlBody }}
            />
            <button
              onClick={() => setEmailPreview(null)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}