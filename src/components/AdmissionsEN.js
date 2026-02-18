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
    fetchApplications();
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await fetch(TEAM_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch team CSV');
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const validMembers = parsed.filter(row => row.Correo?.trim());
      setTeamMembers(validMembers);
      
      console.log('Detected headers:', Object.keys(validMembers[0] || {}));
      console.log('First members (with roles):', validMembers.slice(0, 3).map(m => ({ 
        name: m.Nombre, 
        role: m['Role in the Journal'] || m['Rol en la Revista'] || 'No role' 
      })));
      
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
        app => app['First Name and Last Name']?.trim() && app['Email Direction']?.trim()
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

  const sendPreselection = async (name, app) => {
  if (!APPLICATIONS_GAS_URL) {
    setStatus('❌ GAS URL not configured');
    return;
  }
  if (!confirm(`Send preselection email to ${name}?`)) return;
  setSending(true);
  try {
    // Determine language from form data, default to 'en' if not available
    const language = app['¿Que idioma hablas?/What language do you speak?']?.toLowerCase().includes('español') ? 'es' : 'en';
    await fetch(APPLICATIONS_GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'accept_applicant', name, language }),
    });
    setStatus('✅ Preselection sent');
  } catch (err) {
    setStatus(`❌ Error: ${err.message}`);
  } finally {
    setSending(false);
  }
};
  const acceptAndRequestData = async (app) => {
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL not configured');
      return;
    }
    if (!confirm(`Accept ${app['First Name and Last Name']} and request data?`)) return;
    setSending(true);
    try {
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_and_send_team_acceptance',
          name: app['First Name and Last Name'],
          role: app['Position you wish to apply for'],
          email: app['Email Direction'],
          description: '',
          interests: '',
          image: '',
          language: 'en'
        }),
      });
      setStatus('✅ Accepted and request sent');
      fetchTeam();
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const requestAuthorData = async (name) => {
    if (!TEAM_GAS_URL) {
      setStatus('❌ GAS URL not configured');
      return;
    }
    if (!confirm(`Request data from ${name}?`)) return;
    setSending(true);
    try {
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'request_data',
          type: 'author',
          name,
          language: 'en'
        }),
      });
      setStatus('✅ Data request sent');
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const openEditForm = (member = {}) => {
    const formWindow = window.open('', '_blank');
    formWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${member.Correo ? 'Edit' : 'Add'} Team Member</title>
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
            font-size: 1.5rem;
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
          @media (max-width: 640px) {
            .container {
              margin: 16px;
              padding: 16px;
            }
            h2 {
              font-size: 1.25rem;
            }
            input, textarea {
              font-size: 0.8125rem;
              padding: 10px;
            }
            button {
              padding: 8px 16px;
              font-size: 0.8125rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${member.Correo ? 'Edit' : 'Add'} Team Member</h2>
          <form id="teamForm" class="space-y-6">
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" value="${member.Nombre || ''}" required />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" value="${member.Correo || ''}" required />
            </div>
            <div class="form-group">
              <label>Role in the Journal</label>
              <input type="text" name="role" value="${member['Role in the Journal'] || member['Rol en la Revista'] || member['Position you wish to apply for'] || ''}" required />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea
                name="description"
                placeholder="Example: Francisca Pérez is a second-year high school student at Liceo Nacional de Maipú, with interests in mathematics and chemistry..."
                required
              >${member.Description || member.Descripción || ''}</textarea>
            </div>
            <div class="form-group">
              <label>Areas of Interest</label>
              <input
                type="text"
                name="interests"
                placeholder="Example: History of Ideas, Theoretical Physics, Scientific Outreach"
                required
                value="${member['Areas of interest'] || member['Áreas de interés'] || ''}"
              />
            </div>
            <div class="form-group">
              <label>Image (URL)</label>
              <input
                type="url"
                name="image"
                placeholder="Enter the image URL (uploaded by the administrator)"
                value="${member.Imagen || ''}"
              />
              <p class="help-text">
                Upload the image received via email to <a href="https://postimages.org/" target="_blank">postimages.org</a> and paste the link here.
              </p>
            </div>
            <div class="form-group">
              <label>Language</label>
              <select name="language">
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div class="button-group">
              <button type="button" onclick="window.close()">Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
        <script>
          document.getElementById('teamForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              action: '${member.Correo ? 'update_team_member' : 'add_team_member'}',
              name: formData.get('name'),
              role: formData.get('role'),
              email: formData.get('email'),
              description: formData.get('description'),
              interests: formData.get('interests'),
              image: formData.get('image') || '',
              language: formData.get('language')
            };
            try {
              await fetch('${TEAM_GAS_URL}', {
                method: 'POST',
                mode: 'no-cors',
                redirect: 'follow',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
              });
              alert('Member ' + (data.action === 'update_team_member' ? 'updated' : 'added') + ' successfully');
              window.close();
            } catch (err) {
              alert('Error ' + (data.action === 'update_team_member' ? 'updating' : 'adding') + ' member: ' + err.message);
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
          app['First Name and Last Name']?.trim() &&
          app['Email Direction']?.trim() &&
          !teamEmails.has(app['Email Direction']?.trim().toLowerCase())
      ),
    [applications, teamEmails]
  );

  const archivedApplications = useMemo(
    () =>
      applications.filter(
        app =>
          app['First Name and Last Name']?.trim() &&
          app['Email Direction']?.trim() &&
          teamEmails.has(app['Email Direction']?.trim().toLowerCase())
      ),
    [applications, teamEmails]
  );

  const teamMembersFiltered = useMemo(
    () =>
      teamMembers.filter(member => {
        const rolValue = member['Role in the Journal'] || member['Rol en la Revista'] || '';
        const roles = rolValue ? rolValue.split(';').map(r => r.trim().toLowerCase()) : [];
        return roles.length > 1 || (roles.length === 1 && roles[0] !== 'author');
      }),
    [teamMembers]
  );

  const authorMembers = useMemo(
    () =>
      teamMembers.filter(member => {
        const rolValue = member['Role in the Journal'] || member['Rol en la Revista'] || '';
        const roles = rolValue ? rolValue.split(';').map(r => r.trim().toLowerCase()) : [];
        return roles.length === 1 && roles[0] === 'author';
      }),
    [teamMembers]
  );

  return (
    <div className="container">
      <div className="card">
        <div className="header" onClick={toggleMinimized}>
          <h2 className="header-title">
            Manage Applications ({pendingApplications.length})
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
                Pending ({pendingApplications.length})
              </button>
              <button
                className={`tab ${activeTab === 'archived' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('archived')}
              >
                Archived ({archivedApplications.length})
              </button>
              <button
                className={`tab ${activeTab === 'team' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('team')}
              >
                Team ({teamMembersFiltered.length})
              </button>
              <button
                className={`tab ${activeTab === 'authors' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('authors')}
              >
                Authors ({authorMembers.length})
              </button>
            </div>
            <div className="content">
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <span>Loading...</span>
                </div>
              ) : activeTab === 'team' || activeTab === 'authors' ? (
                <>
                  <div className="p-4">
                    <button
                      onClick={() => openEditForm()}
                      className="action-button action-add mb-4"
                    >
                      Add New Member
                    </button>
                  </div>
                  {(activeTab === 'team' ? teamMembersFiltered : authorMembers).length === 0 ? (
                    <div className="empty">No {activeTab === 'team' ? 'team members' : 'authors'}</div>
                  ) : (
                    (activeTab === 'team' ? teamMembersFiltered : authorMembers).map((member, index) => (
                      <div key={index} className="application">
                        <div className="application-header" onClick={() => toggleExpandApp(`${activeTab}-${index}`)}>
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
                              <p className="application-role">{member['Role in the Journal'] || member['Rol en la Revista'] || 'No role'}</p>
                            </div>
                          </div>
                          <svg
                            className={`application-icon ${expandedApp === `${activeTab}-${index}` ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {expandedApp === `${activeTab}-${index}` && (
                          <div className="application-details">
                            <div className="details-grid">
                              <div>
                                <p className="details-label">Email</p>
                                <p className="details-value">{member.Correo}</p>
                              </div>
                              <div>
                                <p className="details-label">Description</p>
                                <p className="details-value">{member.Description || member.Descripción || ''}</p>
                              </div>
                              <div>
                                <p className="details-label">Areas of Interest</p>
                                <p className="details-value">{member['Areas of interest'] || member['Áreas de interés'] || ''}</p>
                              </div>
                              <div>
                                <p className="details-label">Image</p>
                                <p className="details-value">{member.Imagen || ''}</p>
                              </div>
                            </div>
                            <div className="actions mt-4">
                              <button
                                onClick={() => openEditForm(member)}
                                className="action-button action-edit"
                              >
                                Edit
                              </button>
                              {activeTab === 'authors' && (
                                <button
                                  onClick={() => requestAuthorData(member.Nombre)}
                                  disabled={sending || !TEAM_GAS_URL}
                                  className="action-button action-request"
                                >
                                  Request Data
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </>
              ) : (activeTab === 'pending' ? pendingApplications : archivedApplications).length === 0 ? (
                <div className="empty">No applications</div>
              ) : (
                (activeTab === 'pending' ? pendingApplications : archivedApplications).map((app, index) => (
                  <div key={index} className="application">
                    <div className="application-header" onClick={() => toggleExpandApp(index)}>
                      <div className="application-info">
                        <h3 className="application-name">{app['First Name and Last Name']}</h3>
                        <p className="application-role">{app['Position you wish to apply for']}</p>
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
                            <p className="details-label">Email</p>
                            <p className="details-value">{app['Email Direction']}</p>
                          </div>
                          <div>
                            <p className="details-label">Educational Establishment</p>
                            <p className="details-value">{app['Educational establishment']}</p>
                          </div>
                          <div>
                            <p className="details-label">Phone Number</p>
                            <p className="details-value">{app['Phone number']}</p>
                          </div>
                          <div>
                            <p className="details-label">Cover Letter</p>
                            <p className="details-value">{app['Short cover letter (why you want this position) and list of achievements. 250-500 words.']}</p>
                          </div>
                        </div>
                        <div className="actions">
                          <button
  onClick={() => sendPreselection(app['First Name and Last Name'], app)}
  disabled={sending || !APPLICATIONS_GAS_URL || activeTab === 'archived'}
  className="action-button action-preselect"
>
  Send Preselection
</button>
                          <button
                            onClick={() => acceptAndRequestData(app)}
                            disabled={sending || !TEAM_GAS_URL || activeTab === 'archived'}
                            className="action-button action-accept"
                          >
                            Accept and Request Data
                          </button>
                          <button
                            onClick={() => openEditForm({
                              Nombre: app['First Name and Last Name'],
                              Correo: app['Email Direction'],
                              'Role in the Journal': app['Position you wish to apply for'],
                              Description: '',
                              'Areas of interest': '',
                              Imagen: '',
                            })}
                            disabled={sending || !TEAM_GAS_URL}
                            className="action-button action-add"
                          >
                            Add to Team
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
          max-width: 1400px;
          margin: 16px auto;
          padding: 0 16px;
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
          padding: 16px 24px;
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
          padding: 8px;
        }
        .tab {
          padding: 12px 20px;
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
          max-height: 70vh;
          overflow-y: auto;
          padding: 16px;
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
          padding: 12px 20px;
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
          padding: 16px 20px;
          background: #f3f4f6;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        .action-request {
          background: #e0f2fe;
          color: #075985;
        }
        .action-request:hover {
          background: #bae6fd;
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
        @media (max-width: 640px) {
          .container {
            padding: 0 8px;
            margin: 8px auto;
          }
          .header {
            padding: 12px 16px;
          }
          .header-title {
            font-size: 1.125rem;
          }
          .tabs {
            padding: 4px;
          }
          .tab {
            padding: 8px 12px;
            font-size: 0.8125rem;
          }
          .content {
            padding: 8px;
          }
          .application-header {
            padding: 8px 12px;
          }
          .application-details {
            padding: 8px 12px;
          }
          .details-grid {
            grid-template-columns: 1fr;
          }
          .action-button {
            padding: 6px 12px;
            font-size: 0.8125rem;
          }
        }
      `}</style>
    </div>
  );
}
