import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const INCOMING_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJx5loBW2UoEAhkdkkjad7VQxtjBJKtZT8ZIBMd0NGdAZH7Z2hKNczn1OrTHZRrBzI5_mQRHzxYxHS/pub?gid=1161174444&single=true&output=csv';
const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwReIbgZ-BlSFGftmRCimCPRHn1Few1dgMGdK7y7taC8nydi8-9pEzNTlRWqBXpbhMC/exec';

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
          const roles = (u['Rol en la Revista'] || '').split(';').map(r => r.trim()).filter(Boolean);
          return roles.some(r => r === 'Revisor' || r === 'Editor de Sección');
        });
        setUsers(filteredUsers);

        const revs = filteredUsers.filter(u => (u['Rol en la Revista'] || '').split(';').map(r => r.trim()).includes('Revisor'));
        const eds = filteredUsers.filter(u => (u['Rol en la Revista'] || '').split(';').map(r => r.trim()).includes('Editor de Sección'));
        setReviewers(revs);
        setSectionEditors(eds);

        const parsedIncoming = Papa.parse(incomingText, { header: true, skipEmptyLines: true }).data.filter(i => 
          i['Nombre (primer nombre y primer apellido)'] && 
          i['Título de su artículo'] && 
          i['Nombre (primer nombre y primer apellido)'].trim() && 
          i['Título de su artículo'].trim()
        );
        setIncoming(parsedIncoming);

        const parsedAssignments = Papa.parse(assignmentsText, { header: true, skipEmptyLines: true }).data.filter(a => 
          a['Nombre Artículo'] && 
          a['Nombre Artículo'].trim() && 
          a.Autor && 
          a.Autor.trim()
        );
        const isCompleted = (assign) => {
          return !!(assign['Feedback 1'] && assign['Informe 1'] && assign['Feedback 2'] && assign['Informe 2'] && assign['Feedback 3'] && assign['Informe 3']);
        };
        const pendingAssignments = parsedAssignments.filter(a => !isCompleted(a));
        setAssignments(pendingAssignments);

        console.log('Parsed incoming:', parsedIncoming);
        console.log('Parsed assignments (pending only):', pendingAssignments);
        console.log('Incoming keys:', parsedIncoming[0] ? Object.keys(parsedIncoming[0]) : []);
        console.log('Assignments keys:', parsedAssignments[0] ? Object.keys(parsedAssignments[0]) : []);
      } catch (err) {
        console.error('Error fetching data:', err);
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
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.text();
      if (result.startsWith('Error')) {
        throw new Error(result);
      }
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Éxito: ' + (isUpdate ? 'Actualizado' : 'Asignado') });
      setEditingId(null);
      setEditingData(null);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setSubmitStatus({ ...submitStatus, [articleKey]: 'Error al ' + (isUpdate ? 'actualizar' : 'asignar') + ': ' + err.message });
      console.error('Error submitting:', err);
    }
  };

  const handleContact = async (email, name, title, role) => {
    if (!email || !name || !title || !role) {
      console.error('Missing email, name, title, or role:', { email, name, title, role });
      setSubmitStatus({ ...submitStatus, [name || 'contact']: 'Error: Correo, nombre, título o rol no disponible' });
      return;
    }
    const body = {
      action: 'sendReminder',
      email,
      name,
      title,
      role,
      senderName: user.name,
    };
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.text();
      if (result.startsWith('Error')) {
        throw new Error(result);
      }
      setSubmitStatus({ ...submitStatus, [name]: 'Éxito: Recordatorio enviado a ' + name });
    } catch (err) {
      setSubmitStatus({ ...submitStatus, [name]: 'Error al enviar recordatorio: ' + err.message });
      console.error('Error sending reminder:', err);
    }
  };

  const getUniqueId = (groupAuthor, artTitle) => {
    return `${sanitizeInput(groupAuthor)}-${sanitizeInput(artTitle || 'unnamed')}`;
  };

  const tutorialSteps = [
    '1. Explora la lista de colaboradores haciendo clic en sus perfiles para ver descripciones, intereses y contactarlos si no cumplen plazos (usa el botón "Contactar" para un email profesional).',
    '2. En "Artículos por Autor", los artículos se agrupan por autor usando el "Título de su artículo". Se muestran solo los pendientes (sin todas las retroalimentaciones/informes).',
    '3. Haz clic en "Asignar" para artículos sin asignación o "Editar" para actualizar. Completa los campos (título, link, revisores, editor) y confirma.',
    '4. Usa los botones de contacto para enviar recordatorios institucionales por correo desde el servidor.',
    '5. El panel es responsive. Los artículos con todas las retroalimentaciones se ocultan automáticamente, independientemente del "Estado".',
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
            <button
              onClick={() => handleContact(selectedUser.Correo, selectedUser.Nombre, 'General', (selectedUser['Rol en la Revista'] || '').includes('Revisor') ? 'Revisor' : 'Editor')}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
            >
              Contactar por Email (Recordatorio Sensible)
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
                    const statusBadge = isAssigned ? 'Asignado (en revisión)' : 'Pendiente de asignar';
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
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${badgeClass}`}>
                            {statusBadge}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <button
                            onClick={handleEditOrAssignClick}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            {isAssigned ? 'Editar' : 'Asignar'}
                          </button>
                          {isAssigned && art.assignment['Revisor 1'] && (
                            <button
                              onClick={() => {
                                const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 1']);
                                handleContact(reviewer?.Correo, art.assignment['Revisor 1'], art['Título de su artículo'], 'Revisor 1');
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                            >
                              Contactar R1
                            </button>
                          )}
                          {isAssigned && art.assignment['Revisor 2'] && (
                            <button
                              onClick={() => {
                                const reviewer = reviewers.find(r => r.Nombre === art.assignment['Revisor 2']);
                                handleContact(reviewer?.Correo, art.assignment['Revisor 2'], art['Título de su artículo'], 'Revisor 2');
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                            >
                              Contactar R2
                            </button>
                          )}
                          {isAssigned && art.assignment.Editor && (
                            <button
                              onClick={() => {
                                const editor = sectionEditors.find(e => e.Nombre === art.assignment.Editor);
                                handleContact(editor?.Correo, art.assignment.Editor, art['Título de su artículo'], 'Editor');
                              }}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                            >
                              Contactar Editor
                            </button>
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
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={handleConfirm}
                                disabled={!editingData.data.nombre || !editingData.data.link || !editingData.data.r1 || !editingData.data.r2 || !editingData.data.editor}
                                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                              >
                                {editingData.isUpdate ? 'Actualizar' : 'Asignar'}
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
    </div>
  );
}