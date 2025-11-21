import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

const APPLICATIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNuBETm7TapO6dakKBbkxlYTZctAGGEp4SnOyGowCYXfD_lAXHta8_LX5EPjy0xXw5fpKp3MPcRduK/pub?gid=2123840957&single=true&output=csv';
const TEAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TEAM_GAS_URL = process.env.REACT_APP_TEAM_SCRIPT_URL || '';
const APPLICATIONS_GAS_URL = process.env.REACT_APP_APPLICATIONS_SCRIPT_URL || '';

export default function Admisiones() {
  const [postulaciones, setPostulaciones] = useState([]);
  const [miembrosEquipo, setMiembrosEquipo] = useState([]);
  const [emailsEquipo, setEmailsEquipo] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [postExpandida, setPostExpandida] = useState(null);
  const [mensajeEstado, setMensajeEstado] = useState('');
  const [minimizado, setMinimizado] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState('pendientes');

  useEffect(() => {
    cargarEquipo();
    cargarPostulaciones();
  }, []);

  const cargarEquipo = async () => {
    try {
      const response = await fetch(TEAM_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el CSV del equipo');
      const texto = await response.text();
      const datos = Papa.parse(texto, { header: true, skipEmptyLines: true }).data;
      const miembrosValidos = datos.filter(m => m.Correo?.trim());
      setMiembrosEquipo(miembrosValidos);

      const emails = new Set(miembrosValidos.map(m => m.Correo?.trim().toLowerCase()));
      setEmailsEquipo(emails);
    } catch (err) {
      setMensajeEstado(`Error cargando equipo: ${err.message}`);
    }
  };

  const cargarPostulaciones = async () => {
    try {
      setCargando(true);
      const response = await fetch(APPLICATIONS_CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el CSV de postulaciones');
      const texto = await response.text();
      const datos = Papa.parse(texto, { header: true, skipEmptyLines: true }).data;

      const validas = datos.filter(p =>
        p['Nombre']?.trim() && p['Dirección de correo electrónico']?.trim()
      );
      setPostulaciones(validas);
    } catch (err) {
      setMensajeEstado(`Error: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const alternarMinimizado = () => setMinimizado(prev => !prev);

  const alternarExpandir = (id) => {
    setPostExpandida(postExpandida === id ? null : id);
  };

  const enviarPreseleccion = async (nombre, postulante) => {
    if (!APPLICATIONS_GAS_URL) return setMensajeEstado('URL del script de postulaciones no configurada');
    if (!confirm(`¿Enviar correo de preselección a ${nombre}?`)) return;

    setEnviando(true);
    try {
      const idioma = postulante['¿Que idioma hablas?/What language do you speak?']
        ?.toLowerCase()
        .includes('español') ? 'es' : 'en';

      await fetch(APPLICATIONS_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'accept_applicant',
          name: nombre,
          language: idioma
        }),
      });
      setMensajeEstado('Preselección enviada correctamente');
    } catch (err) {
      setMensajeEstado(`Error al enviar preselección: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const aceptarYPedirDatos = async (postulante) => {
    if (!TEAM_GAS_URL) return setMensajeEstado('URL del script de equipo no configurada');
    if (!confirm(`¿Aceptar a ${postulante['Nombre']} y pedirle sus datos para el equipo?`)) return;

    setEnviando(true);
    try {
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'add_and_send_team_acceptance',
          name: postulante['Nombre'],
          role: postulante['Cargo al que desea postular'],
          email: postulante['Dirección de correo electrónico'],
          description: '',
          interests: '',
          image: '',
          language: 'es'
        }),
      });
      setMensajeEstado('Aceptado y correo de solicitud de datos enviado');
      cargarEquipo(); // para actualizar lista de emails
    } catch (err) {
      setMensajeEstado(`Error: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const solicitarDatosAutor = async (nombre) => {
    if (!TEAM_GAS_URL) return setMensajeEstado('URL del script no configurada');
    if (!confirm(`¿Solicitar datos actualizados a ${nombre}?`)) return;

    setEnviando(true);
    try {
      await fetch(TEAM_GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'request_data',
          type: 'author',
          name: nombre,
          language: 'es'
        }),
      });
      setMensajeEstado('Solicitud de datos enviada');
    } catch (err) {
      setMensajeEstado(`Error: ${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const abrirFormularioEquipo = (miembro = {}) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${miembro.Correo ? 'Editar' : 'Agregar'} Miembro del Equipo</title>
        <style>
          body {font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh;}
          .cont {max-width:640px; width:90%; background:white; padding:32px; border-radius:16px; box-shadow:0 10px 40px rgba(0,0,0,0.15);}
          h2 {text-align:center; color:#1e293b; margin-bottom:24px;}
          label {display:block; margin:16px 0 8px; font-weight:600; color:#374151;}
          input, textarea, select {width:100%; padding:12px; border:1px solid #d1d5db; border-radius:8px; font-size:15px;}
          textarea {min-height:120px; resize:vertical;}
          .btns {display:flex; justify-content:flex-end; gap:12px; margin-top:32px;}
          button {padding:10px 24px; border:none; border-radius:8px; font-weight:600; cursor:pointer;}
          .guardar {background:#3b82f6; color:white;}
          .cancelar {background:#e2e8f0; color:#475569;}
        </style>
      </head>
      <body>
        <div class="cont">
          <h2>${miembro.Correo ? 'Editar' : 'Agregar'} Miembro del Equipo</h2>
          <form id="form">
            <label>Nombre completo</label>
            <input type="text" name="nombre" value="${miembro.Nombre || ''}" required>

            <label>Correo electrónico</label>
            <input type="email" name="email" value="${miembro.Correo || ''}" required>

            <label>Rol en la Revista</label>
            <input type="text" name="rol" value="${miembro['Rol en la Revista'] || ''}" required>

            <label>Descripción</label>
            <textarea name="descripcion" placeholder="Ejemplo: Estudiante de segundo medio del Liceo Nacional de Maipú...">${miembro.Descripción || ''}</textarea>

            <label>Áreas de interés</label>
            <input type="text" name="intereses" placeholder="Física Teórica; Divulgación Científica; Historia" value="${miembro['Áreas de interés'] || ''}" required>

            <label>URL de la foto</label>
            <input type="url" name="imagen" value="${miembro.Imagen || ''}">

            <label>Idioma del correo</label>
            <select name="idioma">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>

            <div class="btns">
              <button type="button" class="cancelar" onclick="window.close()">Cancelar</button>
              <button type="submit" class="guardar">Guardar</button>
            </div>
          </form>
        </div>
        <script>
          document.getElementById('form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = {
              action: '${miembro.Correo ? 'update_team_member' : 'add_team_member'}',
              name: fd.get('nombre'),
              role: fd.get('rol'),
              email: fd.get('email'),
              description: fd.get('descripcion'),
              interests: fd.get('intereses'),
              image: fd.get('imagen') || '',
              language: fd.get('idioma')
            };
            try {
              await fetch('${TEAM_GAS_URL}', {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify(payload)
              });
              alert('Miembro ${payload.action === 'update_team_member' ? 'actualizado' : 'agregado'} con éxito');
              window.close();
            } catch(err) {
              alert('Error: ' + err.message);
            }
          };
        </script>
      </body>
      </html>
    `);
  };

  // Filtros
  const pendientes = useMemo(() => postulaciones.filter(p =>
    !emailsEquipo.has(p['Dirección de correo electrónico']?.trim().toLowerCase())
  ), [postulaciones, emailsEquipo]);

  const archivadas = useMemo(() => postulaciones.filter(p =>
    emailsEquipo.has(p['Dirección de correo electrónico']?.trim().toLowerCase())
  ), [postulaciones, emailsEquipo]);

  const equipoPrincipal = useMemo(() => miembrosEquipo.filter(m => {
    const roles = (m['Rol en la Revista'] || '').split(';').map(r => r.trim().toLowerCase());
    return roles.length > 1 || (roles.length === 1 && roles[0] !== 'author');
  }), [miembrosEquipo);

  const autores = useMemo(() => miembrosEquipo.filter(m => {
    const roles = (m['Rol en la Revista'] || '').split(';').map(r => r.trim().toLowerCase());
    return roles.length === 1 && roles[0] === 'author';
  }), [miembrosEquipo]);

  return (
    <div className="container">
      <div className="card">
        <div className="header" onClick={alternarMinimizado}>
          <h2 className="header-title">
            Gestionar Postulaciones ({pendientes.length})
          </h2>
          <svg className={`header-icon ${!minimizado ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {!minimizado && (
          <>
            <div className="tabs">
              <button className={`tab ${pestanaActiva === 'pendientes' ? 'tab-active' : ''}`} onClick={() => setPestanaActiva('pendientes')}>
                Pendientes ({pendientes.length})
              </button>
              <button className={`tab ${pestanaActiva === 'archivadas' ? 'tab-active' : ''}`} onClick={() => setPestanaActiva('archivadas')}>
                Archivadas ({archivadas.length})
              </button>
              <button className={`tab ${pestanaActiva === 'equipo' ? 'tab-active' : ''}`} onClick={() => setPestanaActiva('equipo')}>
                Equipo ({equipoPrincipal.length})
              </button>
              <button className={`tab ${pestanaActiva === 'autores' ? 'tab-active' : ''}`} onClick={() => setPestanaActiva('autores')}>
                Autores ({autores.length})
              </button>
            </div>

            <div className="content">
              {cargando ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <span>Cargando datos...</span>
                </div>
              ) : pestanaActiva === 'equipo' || pestanaActiva === 'autores' ? (
                <>
                  <div style={{padding: '16px'}}>
                    <button onClick={() => abrirFormularioEquipo()} className="action-button action-add">
                      + Agregar nuevo miembro
                    </button>
                  </div>

                  {(pestanaActiva === 'equipo' ? equipoPrincipal : autores).length === 0 ? (
                    <div className="empty">No hay {pestanaActiva === 'equipo' ? 'miembros del equipo' : 'autores'} aún</div>
                  ) : (
                    (pestanaActiva === 'equipo' ? equipoPrincipal : autores).map((m, i) => (
                      <div key={i} className="application">
                        <div className="application-header" onClick={() => alternarExpandir(`equipo-${i}`)}>
                          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                            {m.Imagen && <img src={m.Imagen} alt={m.Nombre} style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}} />}
                            <div>
                              <h3 className="application-name">{m.Nombre}</h3>
                              <p className="application-role">{m['Rol en la Revista'] || 'Sin rol'}</p>
                            </div>
                          </div>
                          <svg className={`application-icon ${postExpandida === `equipo-${i}` ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {postExpandida === `equipo-${i}` && (
                          <div className="application-details">
                            <div className="details-grid">
                              <div><strong>Correo:</strong> {m.Correo}</div>
                              <div><strong>Descripción:</strong> {m.Descripción || '-'}</div>
                              <div><strong>Áreas de interés:</strong> {m['Áreas de interés'] || '-'}</div>
                              <div><strong>Imagen:</strong> {m.Imagen || 'Sin imagen'}</div>
                            </div>
                            <div className="actions">
                              <button onClick={() => abrirFormularioEquipo(m)} className="action-button action-edit">Editar</button>
                              {pestanaActiva === 'autores' && (
                                <button onClick={() => solicitarDatosAutor(m.Nombre)} disabled={enviando} className="action-button action-request">
                                  Pedir datos actualizados
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </>
              ) : (
                (pestanaActiva === 'pendientes' ? pendientes : archivadas).length === 0 ? (
                  <div className="empty">No hay postulaciones {pestanaActiva === 'pendientes' ? 'pendientes' : 'archivadas'}</div>
                ) : (
                  (pestanaActiva === 'pendientes' ? pendientes : archivadas).map((p, i) => (
                    <div key={i} className="application">
                      <div className="application-header" onClick={() => alternarExpandir(i)}>
                        <div className="application-info">
                          <h3 className="application-name">{p['Nombre']}</h3>
                          <p className="application-role">{p['Cargo al que desea postular']}</p>
                        </div>
                        <svg className={`application-icon ${postExpandida === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {postExpandida === i && (
                        <div className="application-details">
                          <div className="details-grid">
                            <div><strong>Correo:</strong> {p['Dirección de correo electrónico']}</div>
                            <div><strong>Establecimiento:</strong> {p['Establecimiento educativo']}</div>
                            <div><strong>Teléfono:</strong> {p['Número de teléfono']}</div>
                            <div><strong>Carta de motivación y logros:</strong><br/>{p['Breve carta de motivación (por qué desea este cargo) y listado de logros. 250-500 palabras.']}</div>
                          </div>

                          <div className="actions">
                            <button
                              onClick={() => enviarPreseleccion(p['Nombre'], p)}
                              disabled={enviando || pestanaActiva === 'archivadas'}
                              className="action-button action-preselect"
                            >
                              Enviar Preselección
                            </button>

                            <button
                              onClick={() => aceptarYPedirDatos(p)}
                              disabled={enviando || pestanaActiva === 'archivadas'}
                              className="action-button action-accept"
                            >
                              Aceptar y Pedir Datos
                            </button>

                            <button
                              onClick={() => abrirFormularioEquipo({
                                Nombre: p['Nombre'],
                                Correo: p['Dirección de correo electrónico'],
                                'Rol en la Revista': p['Cargo al que desea postular'],
                                Descripción: '',
                                'Áreas de interés': '',
                                Imagen: '',
                              })}
                              className="action-button action-add"
                            >
                              Agregar al Equipo Manualmente
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}
            </div>
          </>
        )}

        {mensajeEstado && <div className="status">{mensajeEstado}</div>}
      </div>

      <style jsx>{`
        .container { width: 100%; max-width: 1400px; margin: 20px auto; padding: 0 16px; font-family: 'Inter', sans-serif; }
        .card { background: rgba(255,255,255,0.95); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); overflow: hidden; }
        .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: linear-gradient(90deg, #3b82f6, #60a5fa); color: white; cursor: pointer; }
        .header:hover { background: linear-gradient(90deg, #2563eb, #3b82f6); }
        .header-title { font-size: 1.4rem; font-weight: 600; }
        .header-icon { width: 24px; height: 24px; transition: transform 0.3s; }
        .rotate-180 { transform: rotate(180deg); }
        .tabs { display: flex; border-bottom: 1px solid #e5e7eb; background: #f9fafb; overflow-x: auto; }
        .tab { padding: 12px 20px; font-weight: 500; color: #6b7280; border-bottom: 3px solid transparent; }
        .tab-active { color: #3b82f6; border-bottom-color: #3b82f6; }
        .content { max-height: 75vh; overflow-y: auto; padding: 20px; }
        .loading { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 40px; color: #6b7280; }
        .spinner { width: 28px; height: 28px; border: 3px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty { text-align: center; padding: 40px; color: #94a3b8; }
        .application { margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white; }
        .application-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; cursor: pointer; }
        .application-name { margin: 0; font-size: 1.1rem; font-weight: 600; }
        .application-role { margin: 4px 0 0; color: #64748b; }
        .application-details { padding: 20px; background: #f1f5f9; }
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; }
        .action-button { padding: 10px 18px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .action-preselect { background: #dbeafe; color: #1e40af; }
        .action-accept { background: #dcfce7; color: #166534; }
        .action-add { background: #ede9fe; color: #6b21a8; }
        .action-edit { background: #fef3c7; color: #92400e; }
        .action-request { background: #e0f2fe; color: #0c4a6e; }
        .action-button:hover { transform: translateY(-2px); filter: brightness(0.95); }
        .action-button:disabled { opacity: 0.5; cursor: not-allowed; }
        .status { padding: 16px; text-align: center; background: #f3f4f6; border-top: 1px solid #e5e7eb; font-weight: 500; }
        @media (max-width: 640px) {
          .details-grid { grid-template-columns: 1fr; }
          .actions { justify-content: center; }
        }
      `}</style>
    </div>
  );
}
