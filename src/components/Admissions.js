import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const APPLICATIONS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNuBETm7TapO6dakKBbkxlYTZctAGGEp4SnOyGowCYXfD_lAXHta8_LX5EPjy0xXw5fpKp3MPcRduK/pub?gid=2123840957&single=true&output=csv';

export default function Admissions() {

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [applications, setApplications] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamEmails, setTeamEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedApp, setExpandedApp] = useState(null);
  const [status, setStatus] = useState('');
  const [minimized, setMinimized] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [editingMember, setEditingMember] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 🔒 CONTROL DE ACCESO
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setHasAccess(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult(true);
        const roles = tokenResult.claims.roles || [];

        if (roles.includes('Director General')) {
          setFirebaseUser(user);
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error(error);
        setHasAccess(false);
      } finally {
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeamMembers(members);
      const emails = new Set(members.map(m => m.email?.trim().toLowerCase()));
      setTeamEmails(emails);
    });
    return unsub;
  }, []);

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

  const openEditModal = (member = {}) => {
    setEditingMember({
      uid: member.id || '',
      name: member.displayName || '',
      email: member.email || '',
      role: (member.roles || []).join(';'),
      descriptionEs: member.description?.es || '',
      descriptionEn: member.description?.en || '',
      interestsEs: member.interests?.es || '',
      interestsEn: member.interests?.en || '',
      imageUrl: member.imageUrl || ''
    });
    setShowModal(true);
  };

  const saveMember = async () => {
    if (!editingMember.uid) {
      setStatus('Adding new members not supported');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', editingMember.uid), {
        displayName: editingMember.name,
        roles: editingMember.role.split(';').map(r => r.trim()),
        description: { es: editingMember.descriptionEs, en: editingMember.descriptionEn || editingMember.descriptionEs },
        interests: { es: editingMember.interestsEs, en: editingMember.interestsEn || editingMember.interestsEs },
        imageUrl: editingMember.imageUrl
      });
      const functions = getFunctions();
      const updateRoleCF = httpsCallable(functions, 'updateUserRole');
      await updateRoleCF({ targetUid: editingMember.uid, newRoles: editingMember.role.split(';').map(r => r.trim()) });
      if (firebaseUser && firebaseUser.uid === editingMember.uid) {
  await firebaseUser.getIdToken(true);
}

      setStatus('✅ Miembro actualizado');
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setShowModal(false);
    }
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

  const teamMembersFiltered = useMemo(
    () =>
      teamMembers.filter(member => {
        const roles = member.roles || [];
        return roles.length > 1 || (roles.length === 1 && roles[0].toLowerCase() !== 'autor');
      }),
    [teamMembers]
  );

  const authorMembers = useMemo(
    () =>
      teamMembers.filter(member => {
        const roles = member.roles || [];
        return roles.length === 1 && roles[0].toLowerCase() === 'autor';
      }),
    [teamMembers]
  );
if (checkingAuth) {
  return <div className="container">Verificando acceso...</div>;
}

if (!hasAccess) {
  return <div className="container">No autorizado.</div>;
}

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
                Equipo ({teamMembersFiltered.length})
              </button>
              <button
                className={`tab ${activeTab === 'authors' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('authors')}
              >
                Autores ({authorMembers.length})
              </button>
            </div>
            <div className="content">
              {loading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <span>Cargando...</span>
                </div>
              ) : activeTab === 'team' || activeTab === 'authors' ? (
                <>
                  {(activeTab === 'team' ? teamMembersFiltered : authorMembers).length === 0 ? (
                    <div className="empty">No hay {activeTab === 'team' ? 'miembros en el equipo' : 'autores'}</div>
                  ) : (
                    (activeTab === 'team' ? teamMembersFiltered : authorMembers).map((member, index) => (
                      <div key={index} className="application">
                        <div className="application-header" onClick={() => toggleExpandApp(`${activeTab}-${index}`)}>
                          <div className="flex items-center space-x-3">
                            {member.imageUrl && (
                              <img
                                src={member.imageUrl}
                                alt={member.displayName}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            )}
                            <div className="application-info">
                              <h3 className="application-name">{member.displayName}</h3>
                              <p className="application-role">{(member.roles || []).join(', ')}</p>
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
                                <p className="details-label">Correo</p>
                                <p className="details-value">{member.email}</p>
                              </div>
                              <div>
                                <p className="details-label">Descripción</p>
                                <p className="details-value">{member.description?.es || ''}</p>
                              </div>
                              <div>
                                <p className="details-label">Áreas de Interés</p>
                                <p className="details-value">{member.interests?.es || ''}</p>
                              </div>
                              <div>
                                <p className="details-label">Imagen</p>
                                <p className="details-value">{member.imageUrl || ''}</p>
                              </div>
                            </div>
                            <div className="actions mt-4">
                              <button
                                onClick={() => openEditModal(member)}
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
      {showModal && editingMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6">Editar Miembro</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium">Nombre</label>
                <input
                  type="text"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Correo</label>
                <input
                  type="email"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                  className="w-full p-2 border rounded"
                  disabled
                />
              </div>
              <div>
                <label className="block font-medium">Rol (separados por ;)</label>
                <input
                  type="text"
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Descripción (ES)</label>
                <textarea
                  value={editingMember.descriptionEs}
                  onChange={(e) => setEditingMember({ ...editingMember, descriptionEs: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Descripción (EN)</label>
                <textarea
                  value={editingMember.descriptionEn}
                  onChange={(e) => setEditingMember({ ...editingMember, descriptionEn: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Áreas de Interés (ES)</label>
                <input
                  type="text"
                  value={editingMember.interestsEs}
                  onChange={(e) => setEditingMember({ ...editingMember, interestsEs: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Áreas de Interés (EN)</label>
                <input
                  type="text"
                  value={editingMember.interestsEn}
                  onChange={(e) => setEditingMember({ ...editingMember, interestsEn: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Imagen (URL)</label>
                <input
                  type="url"
                  value={editingMember.imageUrl}
                  onChange={(e) => setEditingMember({ ...editingMember, imageUrl: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <button onClick={() => setShowModal(false)} className="bg-gray-300 px-6 py-3 rounded-xl">Cancelar</button>
              <button onClick={saveMember} className="bg-blue-600 text-white px-6 py-3 rounded-xl">Guardar</button>
            </div>
          </div>
        </div>
      )}

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
