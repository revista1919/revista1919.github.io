import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const APPLICATIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNuBETm7TapO6dakKBbkxlYTZctAGGEp4SnOyGowCYXfD_lAXHta8_LX5EPjy0xXw5fpKp3MPcRduK/pub?gid=2123840957&single=true&output=csv';
const TEAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/1FIP4yMTNYtRYWiPwovWGPiWxQZ8wssko8u0-NkZOido/export?format=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';
const APPLICATIONS_GAS_URL = process.env.REACT_APP_APPLICATIONS_SCRIPT_URL || '';

export default function Admissions() {
  const [applications, setApplications] = useState([]);
  const [teamEmails, setTeamEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedApp, setExpandedApp] = useState(null);
  const [status, setStatus] = useState('');
  const [minimized, setMinimized] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!minimized) {
      fetchApplications();
      fetchTeamEmails();
    }
  }, [minimized]);

  const fetchTeamEmails = async () => {
    try {
      const response = await fetch(TEAM_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch team CSV');
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const emails = new Set(parsed.map(row => row.Correo?.trim().toLowerCase()).filter(email => email));
      setTeamEmails(emails);
    } catch (err) {
      setStatus(`Error fetching team: ${err.message}`);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(APPLICATIONS_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch applications');
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      setApplications(parsed);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMinimized = () => setMinimized(!minimized);

  const toggleExpandApp = (index) => {
    setExpandedApp(expandedApp === index ? null : index);
  };

  const sendPreselection = async (name) => {
    if (!APPLICATIONS_GAS_URL) {
      setStatus('❌ GAS URL no configurada');
      return;
    }
    if (!confirm(`¿Enviar correo de preselección a ${name}?`)) return;
    setSending(true);
    try {
      await fetch(APPLICATIONS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'aceptar_postulante', name }),
      });
      setStatus('✅ Preselección enviada');
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const acceptAndRequestData = async (app) => {
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL no configurada');
      return;
    }
    if (!confirm(`¿Aceptar a ${app.Nombre} y solicitar datos?`)) return;
    setSending(true);
    try {
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_team_member',
          name: app.Nombre,
          role: app['Cargo al que desea postular'],
          email: app['Correo electrónico'],
        }),
      });
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'solicitar_datos',
          type: 'team',
          name: app.Nombre,
        }),
      });
      setStatus('✅ Aceptado y solicitud enviada');
      fetchTeamEmails(); // Refresh team emails to update archived status
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const openTeamForm = (app) => {
    const formWindow = window.open('', '_blank');
    formWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Agregar Miembro al Equipo</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: 'Georgia', serif; }
          .container { max-width: 600px; }
        </style>
      </head>
      <body class="bg-gray-100">
        <div class="container mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">Agregar Miembro al Equipo</h2>
          <form id="teamForm" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                value="${app.Nombre}"
                readonly
                class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Correo</label>
              <input
                type="email"
                value="${app['Correo electrónico']}"
                readonly
                class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Rol en la Revista</label>
              <input
                type="text"
                value="${app['Cargo al que desea postular']}"
                readonly
                class="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                name="description"
                rows="4"
                placeholder="Ejemplo: Francisca Pérez es estudiante de Segundo Medio en el Liceo Nacional de Maipú, con intereses en matemáticas y química..."
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                required
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Áreas de Interés</label>
              <input
                type="text"
                name="interests"
                placeholder="Ejemplo: Historia de las ideas, Física teórica, Divulgación científica"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                required
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Imagen (URL)</label>
              <input
                type="url"
                name="image"
                placeholder="Ingrese la URL de la imagen"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
              <p class="mt-2 text-sm text-gray-600">
                Si no tienes una URL de imagen, 
                <a href="https://postimages.org/es/" target="_blank" class="text-indigo-600 hover:underline">
                  crea una aquí
                </a>.
              </p>
            </div>
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                onclick="window.close()"
                class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
        <script>
          document.getElementById('teamForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              action: 'add_team_member',
              name: "${app.Nombre}",
              role: "${app['Cargo al que desea postular']}",
              email: "${app['Correo electrónico']}",
              description: formData.get('description'),
              interests: formData.get('interests'),
              image: formData.get('image') || ''
            };
            try {
              await fetch('${TEAM_GAS_URL}', {
                method: 'POST',
                mode: 'no-cors',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
              });
              alert('Miembro agregado exitosamente');
              window.close();
            } catch (err) {
              alert('Error al agregar miembro: ' + err.message);
            }
          });
        </script>
      </body>
      </html>
    `);
  };

  return (
    <div className="mt-8 bg-white rounded-lg shadow-sm overflow-hidden">
      <div 
        className="px-6 py-5 border-b border-gray-200 flex justify-between items-center cursor-pointer"
        onClick={toggleMinimized}
      >
        <h2 className="text-lg font-medium text-gray-900">Gestionar Postulaciones ({applications.length})</h2>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${minimized ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {!minimized && (
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-600">Cargando...</div>
          ) : applications.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No hay postulaciones</div>
          ) : (
            applications.map((app, index) => (
              <div key={index} className="hover:bg-gray-50">
                <div
                  className="px-6 py-4 cursor-pointer flex justify-between items-center"
                  onClick={() => toggleExpandApp(index)}
                >
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{app.Nombre}</h3>
                    <p className="text-sm text-gray-500">{app['Cargo al que desea postular']}</p>
                    {teamEmails.has(app['Correo electrónico']?.trim().toLowerCase()) && (
                      <span className="text-xs text-gray-400"> (Archivado)</span>
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedApp === index ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {expandedApp === index && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <p className="text-gray-900 font-medium">Correo</p>
                        <p className="text-gray-600">{app['Correo electrónico']}</p>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Establecimiento</p>
                        <p className="text-gray-600">{app['Establecimiento educativo']}</p>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Teléfono</p>
                        <p className="text-gray-600">{app['Número de teléfono']}</p>
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">Carta de Motivación</p>
                        <p className="text-gray-600 whitespace-pre-wrap">{app['Breve carta de motivación (por qué desea este cargo) y listado de logros. 250-500 palabras.']}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => sendPreselection(app.Nombre)}
                        disabled={sending || !APPLICATIONS_GAS_URL || teamEmails.has(app['Correo electrónico']?.trim().toLowerCase())}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                      >
                        Enviar Preselección
                      </button>
                      <button
                        onClick={() => acceptAndRequestData(app)}
                        disabled={sending || !TEAM_GAS_URL || teamEmails.has(app['Correo electrónico']?.trim().toLowerCase())}
                        className="px-4 py-2 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200 disabled:opacity-50"
                      >
                        Aceptar y Solicitar Datos
                      </button>
                      <button
                        onClick={() => openTeamForm(app)}
                        disabled={sending || !TEAM_GAS_URL}
                        className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-100 rounded-md hover:bg-purple-200 disabled:opacity-50"
                      >
                        Agregar al Equipo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {status && <div className="p-4 text-center text-sm text-gray-600">{status}</div>}
    </div>
  );
}