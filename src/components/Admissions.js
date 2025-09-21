import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

const APPLICATIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNuBETm7TapO6dakKBbkxlYTZctAGGEp4SnOyGowCYXfD_lAXHta8_LX5EPjy0xXw5fpKp3MPcRduK/pub?gid=2123840957&single=true&output=csv';
const TEAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';
const APPLICATIONS_GAS_URL = process.env.REACT_APP_APPLICATIONS_SCRIPT_URL || '';

export default function Admissions() {
  const [applications, setApplications] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamEmails, setTeamEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedApp, setExpandedApp] = useState(null);
  const [status, setStatus] = useState('');
  const [minimized, setMinimized] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (!minimized) {
      fetchApplications();
      fetchTeam();
    }
  }, [minimized]);

  const fetchTeam = async () => {
    try {
      const response = await fetch(TEAM_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch team CSV');
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const validMembers = parsed.filter(row => row.Correo?.trim());
      setTeamMembers(validMembers);
      const emails = new Set(validMembers.map(row => row.Correo?.trim().toLowerCase()));
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
      const validApplications = parsed.filter(
        app => app.Nombre?.trim() && app['Correo electrónico']?.trim()
      );
      setApplications(validApplications);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMinimized = () => setMinimized(!minimized);

  const toggleExpandApp = (id) => {
    setExpandedApp(expandedApp === id ? null : id);
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
          action: 'add_and_send_team_acceptance',
          name: app.Nombre,
          role: app['Cargo al que desea postular'],
          email: app['Correo electrónico'],
        }),
      });
      setStatus('✅ Aceptado y solicitud enviada');
      fetchTeam();
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const openTeamForm = (app) => {
    openEditForm({
      Nombre: app.Nombre,
      'Correo electrónico': app['Correo electrónico'],
      'Cargo al que desea postular': app['Cargo al que desea postular'],
      Descripción: '',
      'Áreas de interés': '',
      Imagen: '',
    });
  };

  const openEditForm = (member = {}) => {
    const formWindow = window.open('', '_blank');
    formWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${member.Correo ? 'Editar' : 'Agregar'} Miembro al Equipo</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            max-width: 600px;
            width: 100%;
            margin: 20px;
            padding: 24px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
          }
          h2 {
            font-size: 1.75rem;
            font-weight: 600;
            color: #1f2937;
            text-align: center;
            margin-bottom: 24px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: #374151;
            margin-bottom: 8px;
          }
          input, textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 0.875rem;
            color: #1f2937;
            background: #f9fafb;
            transition: border-color 0.3s, box-shadow 0.3s;
          }
          input:focus, textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          textarea {
            resize: vertical;
            min-height: 100px;
          }
          .button-group {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
          }
          button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.2s;
          }
          button[type="submit"] {
            background: #3b82f6;
            color: white;
          }
          button[type="button"] {
            background: #e5e7eb;
            color: #374151;
          }
          button:hover {
            transform: translateY(-1px);
          }
          button[type="submit"]:hover {
            background: #2563eb;
          }
          button[type="button"]:hover {
            background: #d1d5db;
          }
          a {
            color: #3b82f6;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .help-text {
            font-size: 0.75rem;
            color: #6b7280;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${member.Correo ? 'Editar' : 'Agregar'} Miembro al Equipo</h2>
          <form id="teamForm" class="space-y-6">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" name="name" value="${member.Nombre || ''}" required />
            </div>
            <div class="form-group">
              <label>Correo</label>
              <input type="email" name="email" value="${member.Correo || member['Correo electrónico'] || ''}" required />
            </div>
            <div class="form-group">
              <label>Rol en la Revista</label>
              <input type="text" name="role" value="${member.Rol || member['Cargo al que desea postular'] || ''}" required />
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea
                name="description"
                placeholder="Ejemplo: Francisca Pérez es estudiante de Segundo Medio en el Liceo Nacional de Maipú, con intereses en matemáticas y química..."
                required
              >${member['Descripción'] || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Áreas de Interés</label>
              <input
                type="text"
                name="interests"
                placeholder="Ejemplo: Historia de las ideas, Física teórica, Divulgación científica"
                required
              value="${member['Áreas de interés'] || ''}" />
            </div>
            <div class="form-group">
              <label>Imagen (URL)</label>
              <input
                type="url"
                name="image"
                placeholder="Ingrese la URL de la imagen"
                value="${member.Imagen || ''}"
              />
              <p class="help-text">
                Si no tienes una URL de imagen, 
                <a href="https://postimages.org/es/" target="_blank">
                  crea una aquí
                </a>.
              </p>
            </div>
            <div class="button-group">
              <button type="button" onclick="window.close()">Cancelar</button>
              <button type="submit">Guardar</button>
            </div>
          </form>
        </div>
        <script>
          document.getElementById('teamForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              name: formData.get('name'),
              role: formData.get('role'),
              email: formData.get('email'),
              description: formData.get('description'),
              interests: formData.get('interests'),
              image: formData.get('image') || ''
            };
            const action = '${member.Correo || member['Correo electrónico'] ? 'update_team_member' : 'add_team_member'}';
            data.action = action;
            try {
              await fetch('${TEAM_GAS_URL}', {
                method: 'POST',
                mode: 'no-cors',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
              });
              alert('Miembro ' + (action === 'update_team_member' ? 'actualizado' : 'agregado') + ' exitosamente');
              window.close();
            } catch (err) {
              alert('Error al ' + (action === 'update_team_member' ? 'actualizar' : 'agregar') + ' miembro: ' + err.message);
            }
          });
        </script>
      </body>
      </html>
    `);
  };

  const pendingApplications = useMemo(
    () =>
      applications.filter(
        app =>
          app.Nombre?.trim() &&
          app['Correo electrónico']?.trim() &&
          !teamEmails.has(app['Correo electrónico']?.trim().toLowerCase())
      ),
    [applications, teamEmails]
  );

  const archivedApplications = useMemo(
    () =>
      applications.filter(
        app =>
          app.Nombre?.trim() &&
          app['Correo electrónico']?.trim() &&
          teamEmails.has(app['Correo electrónico']?.trim().toLowerCase())
      ),
    [applications, teamEmails]
  );

  return (
    <div className="container">
      <div className="card">
        <div className="header" onClick={toggleMinimized}>
          <h2 className="header-title">
            Gestionar Postulaciones ({pendingApplications.length})
          </h2>
          <svg
            className={`header-icon ${minimized ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {!minimized && (
          <div>
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'pending' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('pending')}
              >
                Pendientes ({pendingApplications.length})
              </button>
              <button
                className={`tab ${activeTab === 'archived' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('archived')}
              >
                Archivados ({archivedApplications.length})
              </button>
              <button
                className={`tab ${activeTab === 'team' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                Equipo ({teamMembers.length})
              </button>
            </div>
            <div className="content">
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <span>Cargando...</span>
                </div>
              ) : activeTab === 'team' ? (
                <>
                  <div className="p-4">
                    <button
                      onClick={() => openEditForm()}
                      className="action-button action-add mb-4"
                    >
                      Agregar Nuevo Miembro
                    </button>
                  </div>
                  {teamMembers.length === 0 ? (
                    <div className="empty">No hay miembros en el equipo</div>
                  ) : (
                    teamMembers.map((member, index) => (
                      <div key={index} className="application">
                        <div className="application-header" onClick={() => toggleExpandApp(`team-${index}`)}>
                          <div className="flex items-center space-x-3">
                            {member.Imagen && (
                              <img
                                src={member.Imagen}
                                alt={member.Nombre}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            )}
                            <div className="application-info">
                              <h3 className="application-name">{member.Nombre}</h3>
                              <p className="application-role">{member.Rol}</p>
                            </div>
                          </div>
                          <svg
                            className={`application-icon ${expandedApp === `team-${index}` ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {expandedApp === `team-${index}` && (
                          <div className="application-details">
                            <div className="details-grid">
                              <div>
                                <p className="details-label">Correo</p>
                                <p className="details-value">{member.Correo}</p>
                              </div>
                              <div>
                                <p className="details-label">Descripción</p>
                                <p className="details-value">{member['Descripción']}</p>
                              </div>
                              <div>
                                <p className="details-label">Áreas de Interés</p>
                                <p className="details-value">{member['Áreas de interés']}</p>
                              </div>
                              <div>
                                <p className="details-label">Imagen</p>
                                <p className="details-value">{member.Imagen}</p>
                              </div>
                            </div>
                            <div className="actions mt-4">
                              <button
                                onClick={() => openEditForm(member)}
                                className="action-button action-edit"
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </>
              ) : (activeTab === 'pending' ? pendingApplications : archivedApplications).length === 0 ? (
                <div className="empty">No hay postulaciones</div>
              ) : (
                (activeTab === 'pending' ? pendingApplications : archivedApplications).map((app, index) => (
                  <div key={index} className="application">
                    <div className="application-header" onClick={() => toggleExpandApp(index)}>
                      <div className="application-info">
                        <h3 className="application-name">{app.Nombre}</h3>
                        <p className="application-role">{app['Cargo al que desea postular']}</p>
                      </div>
                      <svg
                        className={`application-icon ${expandedApp === index ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {expandedApp === index && (
                      <div className="application-details">
                        <div className="details-grid">
                          <div>
                            <p className="details-label">Correo</p>
                            <p className="details-value">{app['Correo electrónico']}</p>
                          </div>
                          <div>
                            <p className="details-label">Establecimiento</p>
                            <p className="details-value">{app['Establecimiento educativo']}</p>
                          </div>
                          <div>
                            <p className="details-label">Teléfono</p>
                            <p className="details-value">{app['Número de teléfono']}</p>
                          </div>
                          <div>
                            <p className="details-label">Carta de Motivación</p>
                            <p className="details-value">{app['Breve carta de motivación (por qué desea este cargo) y listado de logros. 250-500 palabras.']}</p>
                          </div>
                        </div>
                        <div className="actions">
                          <button
                            onClick={() => sendPreselection(app.Nombre)}
                            disabled={sending || !APPLICATIONS_GAS_URL || activeTab === 'archived'}
                            className="action-button action-preselect"
                          >
                            Enviar Preselección
                          </button>
                          <button
                            onClick={() => acceptAndRequestData(app)}
                            disabled={sending || !TEAM_GAS_URL || activeTab === 'archived'}
                            className="action-button action-accept"
                          >
                            Aceptar y Solicitar Datos
                          </button>
                          <button
                            onClick={() => openTeamForm(app)}
                            disabled={sending || !TEAM_GAS_URL}
                            className="action-button action-add"
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
          </div>
        )}
        {status && <div className="status">{status}</div>}
      </div>

      <style>{`
        .container {
          width: 100%;
          max-width: 1200px;
          margin: 32px auto;
          font-family: 'Inter', sans-serif;
        }
        .card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          overflow: hidden;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          color: white;
          cursor: pointer;
          transition: background 0.3s;
        }
        .header:hover {
          background: linear-gradient(90deg, #2563eb, #3b82f6);
        }
        .header-title {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .header-icon {
          width: 20px;
          height: 20px;
          transition: transform 0.3s;
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          overflow-x: auto;
        }
        .tab {
          padding: 16px 24px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
          transition: color 0.3s, border-color 0.3s;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
        }
        .tab-active {
          color: #3b82f6;
          border-bottom: 2px solid #3b82f6;
        }
        .tab:hover {
          color: #3b82f6;
        }
        .content {
          max-height: 600px;
          overflow-y: auto;
        }
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          color: #6b7280;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 12px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .empty {
          padding: 24px;
          text-align: center;
          color: #6b7280;
        }
        .application {
          transition: background 0.2s;
        }
        .application:hover {
          background: #f9fafb;
        }
        .application-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          cursor: pointer;
        }
        .application-info {
          flex: 1;
        }
        .application-name {
          font-size: 1rem;
          font-weight: 500;
          color: #1f2937;
        }
        .application-role {
          font-size: 0.875rem;
          color: #6b7280;
        }
        .application-icon {
          width: 16px;
          height: 16px;
          transition: transform 0.3s;
        }
        .application-details {
          padding: 16px 24px;
          background: #f3f4f6;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }
        .details-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
        }
        .details-value {
          font-size: 0.875rem;
          color: #6b7280;
          white-space: pre-wrap;
        }
        .actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .action-button {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.3s, transform 0.2s;
        }
        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .action-preselect {
          background: #dbeafe;
          color: #1e40af;
        }
        .action-preselect:hover {
          background: #bfdbfe;
        }
        .action-accept {
          background: #dcfce7;
          color: #15803d;
        }
        .action-accept:hover {
          background: #bbf7d0;
        }
        .action-add {
          background: #ede9fe;
          color: #6d28d9;
        }
        .action-add:hover {
          background: #ddd6fe;
        }
        .action-edit {
          background: #fef3c7;
          color: #92400e;
        }
        .action-edit:hover {
          background: #fde68a;
        }
        .action-button:hover {
          transform: translateY(-1px);
        }
        .status {
          padding: 16px;
          text-align: center;
          font-size: 0.875rem;
          color: #374151;
          background: #f3f4f6;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
}