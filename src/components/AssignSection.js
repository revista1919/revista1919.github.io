import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const INCOMING_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJx5loBW2UoEAhkdkkjad7VQxtjBJKtZT8ZIBMd0NGdAZH7Z2hKNczn1OrTHZRrBzI5_mQRHzxYxHS/pub?gid=1161174444&single=true&output=csv';
const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJ9znuf_Pa8Hyh4BnsO1pTTduBsXC7kDD0pORWccMTBlckgt0I--NKG69aR_puTAZ5/exec';

const sanitizeInput = (input) => input ? input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : '';

export default function AssignSection({ user, onClose }) {
  const [users, setUsers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [sectionEditors, setSectionEditors] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingIncoming, setEditingIncoming] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
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

        const parsedIncoming = Papa.parse(incomingText, { header: true, skipEmptyLines: true }).data.filter(i => i['Nombre (primer nombre y primer apellido)'] && i['Nombre (primer nombre y primer apellido)'].trim());
        setIncoming(parsedIncoming);

        const parsedAssignments = Papa.parse(assignmentsText, { header: true, skipEmptyLines: true }).data.filter(a => a['Nombre Artículo'] && a['Nombre Artículo'].trim());
        const pendingAssignments = parsedAssignments.filter(a => !a.Estado || a.Estado.trim() !== 'Aceptado');
        setAssignments(pendingAssignments);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingToAssign = incoming.filter(i => 
    !assignments.some(a => (a.Autor || '').trim() === (i['Nombre (primer nombre y primer apellido)'] || '').trim())
  );

  const isCompleted = (assign) => {
    return !!(assign['Feedback 1'] && assign['Informe 1'] && assign['Feedback 2'] && assign['Informe 2'] && assign['Feedback 3'] && assign['Informe 3']);
  };

  const handleAssignOrUpdate = async (data, isUpdate = false) => {
    const action = isUpdate ? 'update' : 'add';
    const body = { action, ...data };
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSubmitStatus({ ...submitStatus, [data['Nombre Artículo'] || data.autor]: 'Éxito: ' + (isUpdate ? 'Actualizado' : 'Asignado') });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setSubmitStatus({ ...submitStatus, [data['Nombre Artículo'] || data.autor]: 'Error al ' + (isUpdate ? 'actualizar' : 'asignar') });
      console.error(err);
    }
  };

  const handleContact = (email, name) => {
    const subject = encodeURIComponent('Recordatorio profesional: Plazos de revisión en la revista');
    const body = encodeURIComponent(
      `Estimado/a ${name},\n\nEspero que este mensaje te encuentre bien. Te escribo en relación con la revisión del artículo asignado en nuestra revista. Notamos que el plazo se acerca y queríamos recordarte amablemente la importancia de tu contribución para mantener el flujo editorial.\n\nSi necesitas alguna extensión o apoyo, no dudes en responder. Apreciamos enormemente tu dedicación.\n\nSaludos cordiales,\n${user.name}\nEditor en Jefe`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const tutorialSteps = [
    '1. Explora la lista de colaboradores haciendo clic en sus perfiles para ver descripciones, intereses y contactarlos si no cumplen plazos (usa el botón "Contactar" para un email profesional).',
    '2. En "Artículos Pendientes de Asignar", ingresa el nombre del artículo, prepara y pega el link de Google Drive, selecciona Revisor 1, Revisor 2 (de la lista de revisores) y Editor de Sección, luego haz clic en "Asignar".',
    '3. En "Asignaciones Actuales", haz clic en "Editar" para reasignar si un colaborador no responde (contacta primero de forma sensible). Los artículos completos (con feedbacks e informes) se ocultan automáticamente.',
    '4. Usa los filtros por área si lo deseas (opcional). El panel es responsive para móvil y desktop.',
    '5. Para archivar completados, el script en la hoja maneja la actualización de "Estado" a "Aceptado" vía no-cors en envíos.',
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
              onClick={() => handleContact(selectedUser.Correo, selectedUser.Nombre)}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
            >
              Contactar por Email (Recordatorio Sensible)
            </button>
          </div>
        </div>
      )}

      <section>
        <h4 className="text-lg font-semibold mb-4">Artículos Pendientes de Asignar ({pendingToAssign.length})</h4>
        <div className="space-y-4">
          {pendingToAssign.map((art, idx) => {
            const tempData = editingIncoming === idx ? editingIncoming : {
              nombre: '',
              link: art['Inserta aquí tu artículo en formato Word. Debe tener de 2.000 a 10.000 palabras.'] || '',
              r1: '',
              r2: '',
              editor: '',
            };
            return (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="font-medium">{art['Nombre (primer nombre y primer apellido)']}</h5>
                    <p className="text-sm text-gray-600">{art['Correo electrónico']}</p>
                    <p className="text-sm text-gray-600">{art['Establecimiento educacional']}</p>
                  </div>
                  <div>
                    <p className="text-sm"><strong>Área:</strong> {art['Área del artículo (e.g.: economía)']}</p>
                    <p className="text-sm"><strong>Resumen:</strong> {sanitizeInput(art['Abstract o resumen (150-300 palabras)']).substring(0, 150)}...</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    placeholder="Nombre del Artículo"
                    value={tempData.nombre}
                    onChange={(e) => setEditingIncoming(idx === editingIncoming ? { ...tempData, nombre: e.target.value } : { nombre: e.target.value, ...tempData })}
                    className="border p-2 rounded-md text-sm"
                  />
                  <input
                    placeholder="Link de Google Drive (preparado por ti)"
                    value={tempData.link}
                    onChange={(e) => setEditingIncoming(idx === editingIncoming ? { ...tempData, link: e.target.value } : { link: e.target.value, ...tempData })}
                    className="border p-2 rounded-md text-sm"
                  />
                  <select
                    value={tempData.r1}
                    onChange={(e) => setEditingIncoming(idx === editingIncoming ? { ...tempData, r1: e.target.value } : { r1: e.target.value, ...tempData })}
                    className="border p-2 rounded-md text-sm"
                  >
                    <option value="">Seleccionar Revisor 1</option>
                    {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                  </select>
                  <select
                    value={tempData.r2}
                    onChange={(e) => setEditingIncoming(idx === editingIncoming ? { ...tempData, r2: e.target.value } : { r2: e.target.value, ...tempData })}
                    className="border p-2 rounded-md text-sm"
                  >
                    <option value="">Seleccionar Revisor 2</option>
                    {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                  </select>
                  <select
                    value={tempData.editor}
                    onChange={(e) => setEditingIncoming(idx === editingIncoming ? { ...tempData, editor: e.target.value } : { editor: e.target.value, ...tempData })}
                    className="border p-2 rounded-md text-sm"
                  >
                    <option value="">Seleccionar Editor</option>
                    {sectionEditors.map((e) => <option key={e.Nombre} value={e.Nombre}>{e.Nombre}</option>)}
                  </select>
                  <div className="sm:col-span-2 flex space-x-2">
                    <button
                      onClick={() => handleAssignOrUpdate({
                        'Nombre Artículo': tempData.nombre,
                        'Link Artículo': tempData.link,
                        'Revisor 1': tempData.r1,
                        'Revisor 2': tempData.r2,
                        Editor: tempData.editor,
                        Autor: art['Nombre (primer nombre y primer apellido)'],
                        Estado: '', 
                      })}
                      disabled={!tempData.nombre || !tempData.link || !tempData.r1 || !tempData.r2 || !tempData.editor}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                    >
                      Asignar
                    </button>
                    {submitStatus[art['Nombre (primer nombre y primer apellido)']] && (
                      <span className={`text-sm ${submitStatus[art['Nombre (primer nombre y primer apellido)']].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                        {submitStatus[art['Nombre (primer nombre y primer apellido)']]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="text-lg font-semibold mb-4">Asignaciones Actuales ({assignments.length})</h4>
        <div className="space-y-4 overflow-x-auto">
          {assignments.map((assign, idx) => {
            const tempData = editingAssignment === assign['Nombre Artículo'] ? editingAssignment : {
              nombre: assign['Nombre Artículo'] || '',
              link: assign['Link Artículo'] || '',
              r1: assign['Revisor 1'] || '',
              r2: assign['Revisor 2'] || '',
              editor: assign['Editor'] || '',
            };
            return (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h5 className="font-medium">{assign['Nombre Artículo'] || 'Sin nombre'}</h5>
                  <p className="text-sm text-gray-600">Autor: {assign.Autor}</p>
                  <p className="text-sm">Revisor 1: {assign['Revisor 1']}</p>
                  <p className="text-sm">Revisor 2: {assign['Revisor 2']}</p>
                  <p className="text-sm">Editor: {assign.Editor}</p>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${isCompleted(assign) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {isCompleted(assign) ? 'Completado (oculto pronto)' : 'Pendiente'}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingAssignment(assign['Nombre Artículo'])}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  {assign['Revisor 1'] && (
                    <button
                      onClick={() => handleContact(reviewers.find(r => r.Nombre === assign['Revisor 1'])?.Correo, assign['Revisor 1'])}
                      className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                    >
                      Contactar R1
                    </button>
                  )}
                  {assign['Revisor 2'] && (
                    <button
                      onClick={() => handleContact(reviewers.find(r => r.Nombre === assign['Revisor 2'])?.Correo, assign['Revisor 2'])}
                      className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                    >
                      Contactar R2
                    </button>
                  )}
                  {assign.Editor && (
                    <button
                      onClick={() => handleContact(sectionEditors.find(e => e.Nombre === assign.Editor)?.Correo, assign.Editor)}
                      className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                    >
                      Contactar Editor
                    </button>
                  )}
                </div>
                {editingAssignment === assign['Nombre Artículo'] && (
                  <div className="mt-4 p-4 bg-white rounded border w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <input
                        placeholder="Nombre del Artículo"
                        value={tempData.nombre}
                        onChange={(e) => setEditingAssignment({ ...tempData, nombre: e.target.value })}
                        className="border p-2 rounded-md text-sm"
                      />
                      <input
                        placeholder="Link de Google Drive"
                        value={tempData.link}
                        onChange={(e) => setEditingAssignment({ ...tempData, link: e.target.value })}
                        className="border p-2 rounded-md text-sm"
                      />
                      <select
                        value={tempData.r1}
                        onChange={(e) => setEditingAssignment({ ...tempData, r1: e.target.value })}
                        className="border p-2 rounded-md text-sm"
                      >
                        <option value="">Revisor 1</option>
                        {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                      </select>
                      <select
                        value={tempData.r2}
                        onChange={(e) => setEditingAssignment({ ...tempData, r2: e.target.value })}
                        className="border p-2 rounded-md text-sm"
                      >
                        <option value="">Revisor 2</option>
                        {reviewers.map((r) => <option key={r.Nombre} value={r.Nombre}>{r.Nombre}</option>)}
                      </select>
                      <select
                        value={tempData.editor}
                        onChange={(e) => setEditingAssignment({ ...tempData, editor: e.target.value })}
                        className="border p-2 rounded-md text-sm"
                      >
                        <option value="">Editor</option>
                        {sectionEditors.map((e) => <option key={e.Nombre} value={e.Nombre}>{e.Nombre}</option>)}
                      </select>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAssignOrUpdate({
                          'Nombre Artículo': tempData.nombre,
                          'Link Artículo': tempData.link,
                          'Revisor 1': tempData.r1,
                          'Revisor 2': tempData.r2,
                          Editor: tempData.editor,
                          Autor: assign.Autor,
                        }, true)}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-sm"
                      >
                        Actualizar
                      </button>
                      <button
                        onClick={() => setEditingAssignment(null)}
                        className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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