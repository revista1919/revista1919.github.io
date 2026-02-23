"use strict";

/* ===================== IMPORTS ===================== */
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2"); // ← QUITAMOS onInit temporalmente
const { onSchedule } = require("firebase-functions/v2/scheduler");
// IMPORTANTE: Configuración global
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
  timeoutSeconds: 120,
  memory: "512MiB"
});

const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// Inicializar Firebase Admin lo antes posible
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log("✅ Firebase Admin inicializado");
  } catch (e) {
    console.error("❌ Error inicializando Firebase Admin:", e.message);
  }
}

// ==================== IMPORTACIONES DINÁMICAS ====================
// Cargamos las dependencias pesadas de forma diferida para evitar fallos en el healthcheck
let GoogleGenAI, Octokit, FormData, fetch, google, http, https;

// Función para cargar dependencias bajo demanda
// Función para cargar dependencias bajo demanda - VERSIÓN MEJORADA
async function loadDependencies() {
  console.log("📦 Cargando dependencias...");
  
  try {
    const modules = await Promise.allSettled([
      import('@google/genai').then(m => m.GoogleGenAI).catch(e => { console.error('Error cargando GoogleGenAI:', e.message); return null; }),
      import('@octokit/rest').then(m => m.Octokit).catch(e => { console.error('Error cargando Octokit:', e.message); return null; }),
      import('form-data').then(m => m.default).catch(e => { console.error('Error cargando FormData:', e.message); return null; }),
      import('node-fetch').then(m => m.default).catch(e => { console.error('Error cargando fetch:', e.message); return null; }),
      import('googleapis').then(m => m.google).catch(e => { console.error('Error cargando googleapis:', e.message); return null; }),
      import('http').then(m => m.default).catch(e => { console.error('Error cargando http:', e.message); return null; }),
      import('https').then(m => m.default).catch(e => { console.error('Error cargando https:', e.message); return null; })
    ]);
    
    GoogleGenAI = modules[0].status === 'fulfilled' ? modules[0].value : null;
    Octokit = modules[1].status === 'fulfilled' ? modules[1].value : null;
    FormData = modules[2].status === 'fulfilled' ? modules[2].value : null;
    fetch = modules[3].status === 'fulfilled' ? modules[3].value : null;
    google = modules[4].status === 'fulfilled' ? modules[4].value : null;
    http = modules[5].status === 'fulfilled' ? modules[5].value : null;
    https = modules[6].status === 'fulfilled' ? modules[6].value : null;
    
    console.log("📦 Estado de dependencias:", {
      GoogleGenAI: !!GoogleGenAI,
      Octokit: !!Octokit,
      FormData: !!FormData,
      fetch: !!fetch,
      google: !!google,
      http: !!http,
      https: !!https
    });
    
    // Inicializar agentes si es posible
    if (http && https && !httpAgent) {
      initAgents();
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error crítico cargando dependencias:", error);
    return false;
  }
}
/* ===================== SECRETS ===================== */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const IMGBB_API_KEY = defineSecret("IMGBB_API_KEY");
const GH_TOKEN = defineSecret("GH_TOKEN");
const DRIVE_SERVICE_ACCOUNT = defineSecret("DRIVE_SERVICE_ACCOUNT");
const OAUTH2_CLIENT_ID = defineSecret('OAUTH2_CLIENT_ID');
const OAUTH2_CLIENT_SECRET = defineSecret('OAUTH2_CLIENT_SECRET');
const OAUTH2_REFRESH_TOKEN = defineSecret('OAUTH2_REFRESH_TOKEN');

const DOMAIN = "https://www.revistacienciasestudiantes.com";
const ALLOWED_ORIGINS = [
  DOMAIN,
  "https://revistacienciasestudiantes.com",
  "http://localhost:3000",
  "http://localhost:5000"
];

/* ===================== GLOBAL CONNECTION POOLING ===================== */
// Agentes HTTP - se inicializarán cuando http/https estén disponibles
let httpAgent = null;
let httpsAgent = null;

// Inicializar agentes cuando sea posible
function initAgents() {
  if (http && https && !httpAgent) {
    httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
    httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
    console.log("🌐 Agentes HTTP/HTTPS inicializados");
  }
}

// Clientes cacheados
let cachedOctokit = null;
let cachedGenAI = null;

/* ===================== TRADUCCIÓN DE ROLES ===================== */
const ES_TO_EN = {
  'Fundador': 'Founder', 'Co-Fundador': 'Co-Founder', 'Director General': 'General Director',
  'Subdirector General': 'Deputy General Director', 'Editor en Jefe': 'Editor-in-Chief',
  'Editor de Sección': 'Section Editor', 'Revisor': 'Reviewer', 'Autor': 'Author',
  'Responsable de Desarrollo Web': 'Web Development Manager',
  'Encargado de Soporte Técnico': 'Technical Support Manager',
  'Encargado de Redes Sociales': 'Social Media Manager',
  'Diseñador Gráfico': 'Graphic Designer',
  'Community Manager': 'Community Manager',
  'Encargado de Nuevos Colaboradores': 'New Collaborators Manager',
  'Coordinador de Eventos o Convocatorias': 'Events or Calls Coordinator',
  'Asesor Legal': 'Legal Advisor',
  'Asesor Editorial': 'Editorial Advisor',
  'Responsable de Finanzas': 'Finance Manager',
  'Responsable de Transparencia': 'Transparency Manager',
  'Asesor Académico': 'Academic Advisor',
  'Encargado de Asignación de Artículos': 'Article Assignment Manager',
  'Institución Colaboradora': 'Partner Institution'
};

/* ===================== UTILIDADES ===================== */
function handleCors(req, res) {
  const origin = req.headers.origin;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    res.set("Access-Control-Allow-Origin", DOMAIN);
  }
  
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, Accept");
  res.set("Access-Control-Max-Age", "3600");
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

function validateOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) return true;
  if (referer) {
    for (const allowed of ALLOWED_ORIGINS) {
      if (referer.startsWith(allowed)) return true;
    }
  }
  return false;
}

function base64DecodeUnicode(str) {
  try { return str ? Buffer.from(str, "base64").toString("utf-8") : ""; } catch { return ""; }
}

function sanitizeInput(input) {
  if (!input) return "";
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
              .replace(/on\w+="[^"]*"/gi, "")
              .trim();
}

function generateSlug(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
             .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* ===================== VALIDACIÓN DE ROL ===================== */
async function validateRole(uid, requiredRole) {
  try {
    const user = await admin.auth().getUser(uid);
    const roles = user.customClaims?.roles || [];
    if (!roles.includes(requiredRole)) {
      throw new Error(`Se requiere rol: ${requiredRole}`);
    }
    return true;
  } catch (error) {
    console.error("Error validating role:", error);
    throw error;
  }
}

/* ===================== GITHUB HELPERS ===================== */
function getOctokit() {
  if (!Octokit) throw new Error("Octokit no está disponible");
  if (!cachedOctokit) {
    const token = GH_TOKEN.value();
    if (!token) throw new Error("GH_TOKEN no configurado");
    cachedOctokit = new Octokit({ auth: token });
  }
  return cachedOctokit;
}

async function uploadPDFToRepo(pdfBase64, fileName, commitMessage, folder = "Articles") {
  const octokit = getOctokit();
  const content = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
  
  await octokit.repos.createOrUpdateFileContents({
    owner: "revista1919",
    repo: "Articles",
    path: fileName,
    message: commitMessage,
    content: content,
    branch: "main"
  });
}

async function deletePDFFromRepo(fileName, commitMessage, folder = "Articles") {
  try {
    const octokit = getOctokit();
    
    const { data } = await octokit.repos.getContent({
      owner: "revista1919",
      repo: "Articles",
      path: fileName,
      branch: "main"
    });
    
    await octokit.repos.deleteFile({
      owner: "revista1919",
      repo: "Articles",
      path: fileName,
      message: commitMessage,
      sha: data.sha,
      branch: "main"
    });
  } catch (error) {
    if (error.status !== 404) throw error;
  }
}

/* ===================== GEMINI ===================== */
async function getGenAI() {
  if (!GoogleGenAI) throw new Error("GoogleGenAI no está disponible");
  if (!cachedGenAI) {
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
    cachedGenAI = new GoogleGenAI({ apiKey });
  }
  return cachedGenAI;
}

async function callGemini(prompt, temperature = 0) {
  const ai = await getGenAI();

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      temperature: temperature,
      maxOutputTokens: 4096
    }
  });

  let text = result.text?.trim() || "";
  
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  
  return text;
}

/* ===================== FUNCIÓN DE TRADUCCIÓN ===================== */
async function translateText(text, source, target) {
  const prompt = `You are a faithful translator for an academic journal.

Task:
Translate the following text from ${source} to ${target}.

Rules:
- Translate faithfully and accurately.
- Do not add, remove, or reinterpret meaning.
- Output ONLY the translated text.

Text to translate:
"${text}"`;

  return await callGemini(prompt);
}

async function translateHtmlFragment(html, source, target) {
  const prompt = `
You are a faithful translator for an academic journal, The National Review of Sciences for Students en inglés, y Revista Nacional de las Ciencias en español.

Task:
Translate all translatable texts in the following HTML code fragment to ${target}.
The original language is ${source}.

Rules:
- Preserve ALL HTML structure exactly
- Only translate user-facing text nodes
- Output ONLY the translated HTML fragment

HTML code fragment to translate:
${html}`;

  return await callGemini(prompt);
}

function splitHtmlContent(html) {
  const maxLength = 2000;
  const fragments = [];
  let current = "";
  let inTag = false;

  for (const char of html) {
    if (char === "<") inTag = true;
    if (char === ">" && inTag) inTag = false;

    current += char;

    if (current.length >= maxLength && !inTag) {
      fragments.push(current);
      current = "";
    }
  }

  if (current) fragments.push(current);
  return fragments;
}

async function translateHtmlFragmentWithSplit(html, source, target) {
  if (html.length < 3000) {
    return await translateHtmlFragment(html, source, target);
  }

  const fragments = splitHtmlContent(html);
  const translated = [];

  for (const frag of fragments) {
    translated.push(
      await translateHtmlFragment(frag, source, target),
    );
  }

  return translated.join("");
}

/* ===================== IMGBB UPLOAD ===================== */
exports.uploadImageToImgBBCallable = onCall(
  { secrets: [IMGBB_API_KEY] },
  async (request) => {
    const { auth } = request;

    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes estar logueado');
    }

    const { imageBase64, name, expiration } = request.data;

    if (!imageBase64) {
      throw new HttpsError('invalid-argument', 'Falta imageBase64');
    }

    try {
      // Cargar fetch y form-data bajo demanda
      if (!fetch || !FormData) {
        await loadDependencies();
        if (!fetch || !FormData) {
          throw new Error("Dependencias fetch/form-data no disponibles");
        }
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const form = new FormData();
      form.append("image", cleanBase64);
      if (name) form.append("name", name);

      const url = new URL("https://api.imgbb.com/1/upload");
      url.searchParams.set("key", IMGBB_API_KEY.value());
      if (expiration) {
        url.searchParams.set("expiration", String(expiration));
      }

      initAgents();
      const response = await fetch(url.toString(), {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
        agent: url.protocol === 'https:' && httpsAgent ? httpsAgent : httpAgent
      });

      const data = await response.json();

      if (!data.success) {
        console.error("ImgBB error:", data);
        throw new HttpsError('internal', 'Error al subir a ImgBB');
      }

      return {
        success: true,
        url: data.data.url,
        display_url: data.data.display_url,
        delete_url: data.data.delete_url,
        uploadedBy: auth.uid
      };

    } catch (err) {
      console.error("Error en uploadImageToImgBBCallable:", err);
      throw new HttpsError('internal', err.message);
    }
  }
);

/* ===================== UPLOAD NEWS ===================== */
exports.uploadNews = onRequest(
  { 
    secrets: [GEMINI_API_KEY],
    cors: true,
    timeoutSeconds: 120
  },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    try {
      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) {
        return res.status(401).json({ error: "No autorizado - Token requerido" });
      }

      let user;
      try {
        user = await admin.auth().verifyIdToken(idToken);
      } catch (authError) {
        console.error("Error verificando token:", authError);
        return res.status(401).json({ error: "Token inválido" });
      }

      try {
        await validateRole(user.uid, "Director General");
      } catch (roleError) {
        return res.status(403).json({ error: "Se requiere rol de Director General" });
      }

      const { title, body, photo, language = "es" } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ error: "Faltan datos: title y body son requeridos" });
      }

      // Verificar que Gemini esté disponible
      if (!GoogleGenAI) {
        await loadDependencies();
        if (!GoogleGenAI) {
          return res.status(500).json({ error: "Servicio de traducción no disponible" });
        }
      }

      const source = language.toLowerCase();
      const target = source === "es" ? "en" : "es";

      const titleSource = sanitizeInput(title);
      const bodySource = base64DecodeUnicode(body) || sanitizeInput(body);

      const titleTarget = await translateText(titleSource, source, target);
      const bodyTarget = await translateHtmlFragmentWithSplit(bodySource, source, target);

      const db = admin.firestore();
      const newsRef = db.collection("news");

      const esTitle = source === "es" ? titleSource : titleTarget;
      const enTitle = source === "es" ? titleTarget : titleSource;
      const esBody = source === "es" ? bodySource : bodyTarget;
      const enBody = source === "es" ? bodyTarget : bodySource;

      const nowIso = new Date().toISOString();

      const docData = {
        title_es: esTitle,
        title_en: enTitle,
        body_es: Buffer.from(esBody).toString("base64"),
        body_en: Buffer.from(enBody).toString("base64"),
        photo: photo || "",
        timestamp_es: nowIso,
        timestamp_en: nowIso,
        createdBy: user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await newsRef.add(docData);

      return res.json({
        success: true,
        id: docRef.id,
        title_source: titleSource,
        title_target: titleTarget
      });

    } catch (err) {
      console.error("Error en uploadNews:", err);
      return res.status(500).json({
        error: "Error interno del servidor",
        message: err.message
      });
    }
  }
);

/* ===================== MANAGE ARTICLES ===================== */
/* ===================== MANAGE ARTICLES ===================== */
exports.manageArticles = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true,
    timeoutSeconds: 120
  },
  async (req, res) => {
    const origin = req.headers.origin;
    const ALLOWED_ORIGINS = [
      'https://www.revistacienciasestudiantes.com',
      'https://revistacienciasestudiantes.com',
      'http://localhost:3000',
      'http://localhost:5000'
    ];

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    } else {
      res.set('Access-Control-Allow-Origin', 'https://www.revistacienciasestudiantes.com');
    }
    
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, X-Requested-With');
    res.set('Access-Control-Max-Age', '3600');
    res.set('Vary', 'Origin');

    // En manageArticles, justo después del bloque CORS
    console.log(`🔍 manageArticles - Request recibido:`);
    console.log(`🔍 Method: ${req.method}`);
    console.log(`🔍 Path: ${req.path}`);
    console.log(`🔍 Original URL: ${req.originalUrl}`);
    console.log(`🔍 Headers:`, req.headers);
    
    if (req.method === 'OPTIONS') {
      console.log('📡 Preflight OPTIONS request recibido');
      res.status(204).send('');
      return;
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const referer = req.headers.referer;
    const isValidOrigin = (origin && ALLOWED_ORIGINS.includes(origin)) || 
                         (referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed)));
    
    if (!isValidOrigin) {
      console.warn('⚠️ Origen no permitido:', origin || referer);
      return res.status(403).json({ error: "Origen no permitido" });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] 🚀 manageArticles - Iniciando petición`);

    try {
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          return res.status(500).json({ error: "Servicio GitHub no disponible" });
        }
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`[${requestId}] ⚠️ No autorizado - Token faltante`);
        return res.status(401).json({ error: "No autorizado - Token requerido" });
      }

      const token = authHeader.split("Bearer ")[1];
      if (!token) {
        return res.status(401).json({ error: "No autorizado - Token inválido" });
      }

      let user;
      try {
        user = await admin.auth().verifyIdToken(token);
        console.log(`[${requestId}] ✅ Usuario autenticado: ${user.email || user.uid}`);
      } catch (authError) {
        console.error(`[${requestId}] ❌ Error verificando token:`, authError.message);
        return res.status(401).json({ error: "Token inválido o expirado" });
      }

      try {
        await validateRole(user.uid, "Director General");
        console.log(`[${requestId}] ✅ Rol verificado: Director General`);
      } catch (roleError) {
        console.error(`[${requestId}] ❌ Error de rol:`, roleError.message);
        return res.status(403).json({ error: "Se requiere rol de Director General" });
      }

      const { action, article, pdfBase64, id } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: "Acción requerida (add/edit/delete)" });
      }

      console.log(`[${requestId}] 📋 Acción recibida: ${action}, ID: ${id || 'nuevo'}`); // <-- PUNTO 1

      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "articless";
      const JSON_PATH = "articles.json";
      const BRANCH = "main";

      async function getCurrentArticlesJson() {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: JSON_PATH,
            ref: BRANCH
          });
          
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          return {
            articles: JSON.parse(content),
            sha: data.sha
          };
        } catch (error) {
          if (error.status === 404) {
            return {
              articles: [],
              sha: null
            };
          }
          throw error;
        }
      }

      async function saveArticlesJson(articles, sha, commitMessage) {
        const content = Buffer.from(JSON.stringify(articles, null, 2)).toString('base64');
        
        if (sha) {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: JSON_PATH,
            message: commitMessage,
            content: content,
            sha: sha,
            branch: BRANCH
          });
        } else {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: JSON_PATH,
            message: commitMessage,
            content: content,
            branch: BRANCH
          });
        }
      }

      function processAuthors(authorsInput) {
        let authorsArray = [];
        
        if (typeof authorsInput === 'string') {
          authorsArray = authorsInput.split(';').map(name => ({
            name: name.trim(),
            authorId: null
          }));
        } else if (Array.isArray(authorsInput)) {
          if (authorsInput.length === 0) return [];
          
          if (typeof authorsInput[0] === 'string') {
            authorsArray = authorsInput.map(name => ({
              name: name.trim(),
              authorId: null
            }));
          } else {
            authorsArray = authorsInput.map(a => ({
              name: a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim(),
              authorId: a.authorId || a.uid || null,
              email: a.email || null,
              institution: a.institution || null,
              orcid: a.orcid || null
            }));
          }
        }
        
        return authorsArray;
      }

      async function uploadPDF(pdfBase64, fileName, commitMessage) {
        const content = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        
        await octokit.repos.createOrUpdateFileContents({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path: `pdfs/${fileName}`,
          message: commitMessage,
          content: content,
          branch: BRANCH
        });
        
        return `https://${REPO_OWNER}.github.io/${REPO_NAME}/pdfs/${fileName}`;
      }

      async function deletePDF(fileName, commitMessage) {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `pdfs/${fileName}`,
            branch: BRANCH
          });
          
          await octokit.repos.deleteFile({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `pdfs/${fileName}`,
            message: commitMessage,
            sha: data.sha,
            branch: BRANCH
          });
        } catch (error) {
          if (error.status !== 404) throw error;
        }
      }

      async function getNextArticleNumber(articles) {
        if (articles.length === 0) return 1;
        const maxNumber = Math.max(...articles.map(a => a.numeroArticulo || 0));
        return maxNumber + 1;
      }

      const { articles: currentArticles, sha } = await getCurrentArticlesJson();
      let updatedArticles = [...currentArticles];
      let responseData = {};

      if (action === "add") {
        if (!article?.titulo) {
          return res.status(400).json({ error: "Datos de artículo incompletos - título requerido" });
        }

        console.log(`[${requestId}] 📝 Creando nuevo artículo: ${article.titulo}`);

        const authorsArray = processAuthors(article.autores);
        const articleNumber = await getNextArticleNumber(currentArticles);
        
        const newArticle = {
          numeroArticulo: articleNumber,
          titulo: article.titulo,
          tituloEnglish: article.tituloEnglish || '',
          autores: authorsArray,
          resumen: article.resumen,
          abstract: article.abstract || '',
          palabras_clave: Array.isArray(article.palabras_clave) ? article.palabras_clave : 
                          (article.palabras_clave ? article.palabras_clave.split(';').map(k => k.trim()) : []),
          keywords_english: Array.isArray(article.keywords_english) ? article.keywords_english :
                           (article.keywords_english ? article.keywords_english.split(';').map(k => k.trim()) : []),
          area: article.area,
          tipo: article.tipo || 'Artículo de Investigación',
          type: article.type || 'Research Article',
          fecha: article.fecha,
          receivedDate: article.receivedDate || '',
          acceptedDate: article.acceptedDate || '',
          volumen: article.volumen,
          numero: article.numero,
          primeraPagina: article.primeraPagina,
          ultimaPagina: article.ultimaPagina,
          conflicts: article.conflicts || 'Los autores declaran no tener conflictos de interés.',
          conflictsEnglish: article.conflictsEnglish || 'The authors declare no conflicts of interest.',
          funding: article.funding || 'No declarada',
          fundingEnglish: article.fundingEnglish || 'Not declared',
          acknowledgments: article.acknowledgments || '',
          acknowledgmentsEnglish: article.acknowledgmentsEnglish || '',
          authorCredits: article.authorCredits || '',
          authorCreditsEnglish: article.authorCreditsEnglish || '',
          dataAvailability: article.dataAvailability || '',
          dataAvailabilityEnglish: article.dataAvailabilityEnglish || '',
          submissionId: article.submissionId || '',
          html_es: article.html_es || '',
          html_en: article.html_en || '',
          referencias: article.referencias || '',
          pdfUrl: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user.uid
        };

        if (pdfBase64) {
          try {
            const slug = generateSlug(article.titulo);
            const fileName = `Article-${slug}-${articleNumber}.pdf`;
            
            console.log(`[${requestId}] 📤 Subiendo PDF: ${fileName}`);
            
            const pdfUrl = await uploadPDF(
              pdfBase64,
              fileName,
              `Add PDF for article #${articleNumber}: ${article.titulo}`
            );
            
            newArticle.pdfUrl = pdfUrl;
            console.log(`[${requestId}] ✅ PDF subido: ${pdfUrl}`);
          } catch (pdfError) {
            console.error(`[${requestId}] ❌ Error subiendo PDF:`, pdfError.message);
          }
        }

        updatedArticles.push(newArticle);
        responseData = { 
          id: articleNumber.toString(),
          articleNumber: articleNumber,
          message: "Artículo creado exitosamente"
        };
      }

      // --- BLOQUE EDIT ---
      if (action === "edit") {
        console.log(`[${requestId}] 🟢 ENTRÓ al bloque EDIT`); // <-- PUNTO 2
        
        if (!id) {
          console.log(`[${requestId}] 🔴 EDIT falló: ID requerido`); // <-- PUNTO 4
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
        
        if (index === -1) {
          console.log(`[${requestId}] 🔴 EDIT falló: Artículo #${articleNumber} no encontrado`); // <-- PUNTO 4
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const oldArticle = updatedArticles[index];
        console.log(`[${requestId}] 📝 Editando artículo #${articleNumber}: ${oldArticle.titulo}`);

        let authorsArray;
        if (article.autores) {
          authorsArray = processAuthors(article.autores);
          
          if (typeof article.autores === 'string' || 
              (Array.isArray(article.autores) && typeof article.autores[0] === 'string')) {
            
            const oldAuthorsMap = new Map(
              (oldArticle.autores || []).map(a => [a.name, a.authorId])
            );
            
            authorsArray = authorsArray.map(a => ({
              ...a,
              authorId: oldAuthorsMap.get(a.name) || a.authorId
            }));
          }
        } else {
          authorsArray = oldArticle.autores || [];
        }

        const updatedArticle = {
          ...oldArticle,
          titulo: article.titulo || oldArticle.titulo,
          tituloEnglish: article.tituloEnglish !== undefined ? article.tituloEnglish : oldArticle.tituloEnglish,
          autores: authorsArray,
          resumen: article.resumen !== undefined ? article.resumen : oldArticle.resumen,
          abstract: article.abstract !== undefined ? article.abstract : oldArticle.abstract,
          palabras_clave: article.palabras_clave ? 
            (Array.isArray(article.palabras_clave) ? article.palabras_clave : article.palabras_clave.split(';').map(k => k.trim())) 
            : oldArticle.palabras_clave,
          keywords_english: article.keywords_english ?
            (Array.isArray(article.keywords_english) ? article.keywords_english : article.keywords_english.split(';').map(k => k.trim()))
            : oldArticle.keywords_english,
          area: article.area || oldArticle.area,
          tipo: article.tipo || oldArticle.tipo,
          type: article.type || oldArticle.type,
          fecha: article.fecha || oldArticle.fecha,
          receivedDate: article.receivedDate !== undefined ? article.receivedDate : oldArticle.receivedDate,
          acceptedDate: article.acceptedDate !== undefined ? article.acceptedDate : oldArticle.acceptedDate,
          volumen: article.volumen || oldArticle.volumen,
          numero: article.numero || oldArticle.numero,
          primeraPagina: article.primeraPagina || oldArticle.primeraPagina,
          ultimaPagina: article.ultimaPagina || oldArticle.ultimaPagina,
          conflicts: article.conflicts !== undefined ? article.conflicts : oldArticle.conflicts,
          conflictsEnglish: article.conflictsEnglish !== undefined ? article.conflictsEnglish : oldArticle.conflictsEnglish,
          funding: article.funding !== undefined ? article.funding : oldArticle.funding,
          fundingEnglish: article.fundingEnglish !== undefined ? article.fundingEnglish : oldArticle.fundingEnglish,
          acknowledgments: article.acknowledgments !== undefined ? article.acknowledgments : oldArticle.acknowledgments,
          acknowledgmentsEnglish: article.acknowledgmentsEnglish !== undefined ? article.acknowledgmentsEnglish : oldArticle.acknowledgmentsEnglish,
          authorCredits: article.authorCredits !== undefined ? article.authorCredits : oldArticle.authorCredits,
          authorCreditsEnglish: article.authorCreditsEnglish !== undefined ? article.authorCreditsEnglish : oldArticle.authorCreditsEnglish,
          dataAvailability: article.dataAvailability !== undefined ? article.dataAvailability : oldArticle.dataAvailability,
          dataAvailabilityEnglish: article.dataAvailabilityEnglish !== undefined ? article.dataAvailabilityEnglish : oldArticle.dataAvailabilityEnglish,
          submissionId: article.submissionId !== undefined ? article.submissionId : oldArticle.submissionId,
          html_es: article.html_es !== undefined ? article.html_es : oldArticle.html_es,
          html_en: article.html_en !== undefined ? article.html_en : oldArticle.html_en,
          referencias: article.referencias !== undefined ? article.referencias : oldArticle.referencias,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid
        };

        if (pdfBase64) {
          try {
            if (oldArticle.pdfUrl) {
              const oldFileName = oldArticle.pdfUrl.split('/').pop();
              console.log(`[${requestId}] 🗑️ Eliminando PDF anterior: ${oldFileName}`);
              
              await deletePDF(
                oldFileName,
                `Delete old PDF for article #${articleNumber}: ${updatedArticle.titulo}`
              );
            }

            const slug = generateSlug(updatedArticle.titulo);
            const fileName = `Article-${slug}-${articleNumber}.pdf`;
            
            console.log(`[${requestId}] 📤 Subiendo nuevo PDF: ${fileName}`);
            
            const pdfUrl = await uploadPDF(
              pdfBase64,
              fileName,
              `Update PDF for article #${articleNumber}: ${updatedArticle.titulo}`
            );
            
            updatedArticle.pdfUrl = pdfUrl;
            console.log(`[${requestId}] ✅ Nuevo PDF subido: ${pdfUrl}`);
          } catch (pdfError) {
            console.error(`[${requestId}] ❌ Error manejando PDF:`, pdfError.message);
          }
        }

        updatedArticles[index] = updatedArticle;
        responseData = { 
          success: true,
          articleNumber: articleNumber,
          message: "Artículo actualizado exitosamente"
        };
        
        console.log(`[${requestId}] 🟢 EDIT completado. Preparando respuesta exitosa...`); // <-- PUNTO 3
        // La respuesta se envía FUERA de este bloque, pero el flujo continúa.
      }

      if (action === "delete") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
        
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const articleToDelete = updatedArticles[index];
        console.log(`[${requestId}] 🗑️ Eliminando artículo #${articleNumber}: ${articleToDelete.titulo}`);

        if (articleToDelete.pdfUrl) {
          try {
            const fileName = articleToDelete.pdfUrl.split('/').pop();
            console.log(`[${requestId}] 🗑️ Eliminando PDF: ${fileName}`);
            
            await deletePDF(
              fileName,
              `Delete PDF for article #${articleNumber}: ${articleToDelete.titulo}`
            );
          } catch (pdfError) {
            console.error(`[${requestId}] ⚠️ Error eliminando PDF:`, pdfError.message);
          }
        }

        updatedArticles.splice(index, 1);
        responseData = { 
          success: true,
          articleNumber: articleNumber,
          message: "Artículo eliminado exitosamente"
        };
      }

      // --- RESPUESTA FINAL ---
      if (action === "add" || action === "edit" || action === "delete") {
        console.log(`[${requestId}] 🟢 Entrando al bloque de guardado y respuesta final para acción: ${action}`); // <-- PUNTO 3 (alternativo)
        
        updatedArticles.sort((a, b) => (a.numeroArticulo || 0) - (b.numeroArticulo || 0));
        
        const commitMessage = `[${action}] Artículo ${action === 'add' ? 'agregado' : action === 'edit' ? 'actualizado' : 'eliminado'} #${responseData.articleNumber || ''} por ${user.email || user.uid}`;
        
        await saveArticlesJson(updatedArticles, sha, commitMessage);
        console.log(`[${requestId}] ✅ articles.json actualizado en GitHub`);

        try {
          await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
            owner: "revista1919",
            repo: "revista1919.github.io",
            event_type: "rebuild-articles",
            client_payload: {
              action: action,
              articleNumber: responseData.articleNumber,
              triggeredBy: user.uid
            }
          });
          console.log(`[${requestId}] 🔄 Rebuild triggered for main site`);
        } catch (rebuildError) {
          console.error(`[${requestId}] ⚠️ Error en rebuild:`, rebuildError.message);
        }

        console.log(`[${requestId}] 🟢 A punto de enviar respuesta JSON exitosa.`); // <-- PUNTO 3 (clave)
        
        return res.json({ 
          success: true,
          ...responseData
        });
      }

      // --- SI LLEGAMOS AQUÍ, ACCIÓN NO VÁLIDA ---
      console.log(`[${requestId}] 🔴 Acción inválida: "${action}" no fue capturada por ningún bloque.`); // <-- PUNTO 5
      return res.status(400).json({ error: "Acción inválida" });

    } catch (err) {
      console.error(`[${requestId}] ❌ Error en manageArticles:`, err);
      
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'manageArticles',
          error: { 
            message: err.message, 
            stack: err.stack,
            requestId 
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error('Error logging to Firestore:', logError);
      }

      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message,
        requestId 
      });
    }
  }
);

/* ===================== MANAGE VOLUMES ===================== */
exports.manageVolumes = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true,
    timeoutSeconds: 120
  },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    try {
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          return res.status(500).json({ error: "Servicio GitHub no disponible" });
        }
      }

      const token = req.headers.authorization?.split("Bearer ")[1];
      if (!token) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const user = await admin.auth().verifyIdToken(token);
      await validateRole(user.uid, "Director General");

      const { action, volume, pdfBase64, id } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: "Acción requerida" });
      }

      const db = admin.firestore();
      const ref = db.collection("volumes");

      if (action === "add") {
        if (!volume?.titulo) {
          return res.status(400).json({ error: "Datos de volumen incompletos" });
        }

        const docRef = await ref.add({
          ...volume,
          pdf: "",
          role: "Director General",
          createdBy: user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (pdfBase64) {
          const slug = generateSlug(volume.titulo);
          const fileName = `Volume-${slug}-${docRef.id.slice(0, 5)}.pdf`;

          await uploadPDFToRepo(
            pdfBase64,
            fileName,
            `Add volume: ${volume.titulo}`,
            "Volumes"
          );

          await docRef.update({
            pdf: `${DOMAIN}/Volumes/${fileName}`,
          });
        }

        return res.json({ success: true, id: docRef.id });
      }

      if (action === "edit") {
        if (!id) {
          return res.status(400).json({ error: "ID de volumen requerido" });
        }

        const docSnap = await ref.doc(id).get();
        if (!docSnap.exists) {
          return res.status(404).json({ error: "Volumen no encontrado" });
        }

        await ref.doc(id).update({
          ...volume,
          updatedBy: user.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (pdfBase64) {
          const oldData = docSnap.data();

          if (oldData.pdf) {
            const oldFileName = oldData.pdf.split("/").pop();
            await deletePDFFromRepo(
              oldFileName,
              `Delete old volume PDF: ${volume.titulo || oldData.titulo}`,
              "Volumes"
            );
          }

          const slug = generateSlug(volume.titulo || oldData.titulo);
          const fileName = `Volume-${slug}-${id.slice(0, 5)}.pdf`;

          await uploadPDFToRepo(
            pdfBase64,
            fileName,
            `Update volume PDF: ${volume.titulo || oldData.titulo}`,
            "Volumes"
          );

          await ref.doc(id).update({
            pdf: `${DOMAIN}/Volumes/${fileName}`,
          });
        }

        return res.json({ success: true });
      }

      if (action === "delete") {
        if (!id) {
          return res.status(400).json({ error: "ID de volumen requerido" });
        }

        const docSnap = await ref.doc(id).get();
        if (!docSnap.exists) {
          return res.status(404).json({ error: "Volumen no encontrado" });
        }

        const data = docSnap.data();

        if (data.pdf) {
          const fileName = data.pdf.split("/").pop();
          await deletePDFFromRepo(
            fileName,
            `Delete volume PDF: ${data.titulo}`,
            "Volumes"
          );
        }

        await ref.doc(id).delete();
        return res.json({ success: true });
      }

      return res.status(400).json({ error: "Acción inválida" });

    } catch (err) {
      console.error("Error en manageVolumes:", err);
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message 
      });
    }
  }
);

/* ===================== TRIGGER REBUILD ===================== */
exports.triggerRebuild = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true
  },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    try {
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          return res.status(500).json({ error: "Servicio GitHub no disponible" });
        }
      }

      const token = req.headers.authorization?.split("Bearer ")[1];
      if (!token) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const user = await admin.auth().verifyIdToken(token);
      await validateRole(user.uid, "Director General");

      const octokit = getOctokit();

      await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
        owner: "revista1919",
        repo: "revista1919.github.io",
        event_type: "rebuild",
      });

      return res.json({ success: true });

    } catch (err) {
      console.error("Error en triggerRebuild:", err);
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message 
      });
    }
  }
);

/* ===================== UPDATE USER ROLE (CALLABLE FUNCTION) ===================== */
exports.updateUserRole = onCall(async (request) => {
  const { auth } = request;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Debes estar logueado');
  }

  try {
    await validateRole(auth.uid, "Director General");
  } catch (err) {
    throw new HttpsError('permission-denied', 'No tienes permiso para esta acción');
  }

  const { targetUid, newRoles } = request.data;
  if (!targetUid || !Array.isArray(newRoles)) {
    throw new HttpsError('invalid-argument', 'Datos inválidos');
  }

  try {
    console.log(`Director ${auth.uid} cambió roles de ${targetUid} a:`, newRoles);

    await admin.auth().setCustomUserClaims(targetUid, { roles: newRoles });
    
    await admin.firestore().collection('users').doc(targetUid).update({
      roles: newRoles,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.uid
    });

    return { success: true };
  } catch (err) {
    console.error("Error en updateUserRole:", err);
    throw new HttpsError('internal', 'Error al actualizar el rol');
  }
});

/* ===================== FUNCIÓN DE SALUD ===================== */
exports.healthCheck = onRequest(
  { cors: true },
  async (req, res) => {
    if (handleCors(req, res)) return;
    
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      functions: ["uploadImageToImgBB", "uploadNews", "manageArticles", "manageVolumes", "triggerRebuild", "updateUserRole"]
    });
  }
);

exports.onUserChange = onDocumentUpdated(
  { document: 'users/{userId}', secrets: [GH_TOKEN] },
  async (event) => {
    try {
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          console.error("Octokit no disponible para onUserChange");
          return;
        }
      }

      const octokit = getOctokit();
      
      await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
        owner: 'revista1919',
        repo: 'team',
        event_type: 'rebuild-team-user',
        client_payload: {
          uid: event.params.userId
        }
      });
      
      console.log(`🚀 Disparado rebuild para usuario ${event.params.userId}`);
    } catch (error) {
      console.error("Error en onUserChange:", error.message);
    }
  }
);

exports.onUserCreate = onDocumentCreated(
  { document: 'users/{userId}', secrets: [GH_TOKEN] },
  async (event) => {
    try {
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          console.error("Octokit no disponible para onUserCreate");
          return;
        }
      }

      const octokit = getOctokit();
      
      await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
        owner: 'revista1919',
        repo: 'team',
        event_type: 'rebuild-team-user',
        client_payload: {
          uid: event.params.userId
        }
      });
      
      console.log(`🚀 Nuevo usuario creado: ${event.params.userId}`);
    } catch (error) {
      console.error("Error en onUserCreate:", error.message);
    }
  }
);

/* ===================== UPDATE ROLE (CALLABLE) ===================== */
exports.updateRole = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión");
  }

  const callerUid = auth.uid;

  try {
    const callerUser = await admin.auth().getUser(callerUid);
    const callerRoles = callerUser.customClaims?.roles || [];

    if (!callerRoles.includes("Director General")) {
      throw new HttpsError(
        "permission-denied",
        "Solo Director General puede modificar roles"
      );
    }

    const { targetUid, newRoles } = data;

    if (!targetUid) {
      throw new HttpsError("invalid-argument", "Falta targetUid");
    }

    if (!Array.isArray(newRoles)) {
      throw new HttpsError("invalid-argument", "newRoles debe ser un array");
    }

    await admin.auth().setCustomUserClaims(targetUid, {
      roles: newRoles,
    });

    await admin
      .firestore()
      .collection("users")
      .doc(targetUid)
      .set(
        {
          roles: newRoles,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: callerUid,
        },
        { merge: true }
      );

    console.log(
      `✅ ${callerUid} actualizó roles de ${targetUid}:`,
      newRoles
    );

    return {
      success: true,
      targetUid,
      roles: newRoles,
    };

  } catch (error) {
    console.error("❌ Error en updateRole:", error);

    if (error instanceof HttpsError) throw error;

    throw new HttpsError("internal", error.message);
  }
});

/* ===================== CHECK ANONYMOUS PROFILE ===================== */
exports.checkAnonymousProfile = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    
    const uid = request.auth.uid;
    const db = admin.firestore();
    
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }
    
    const userEmail = userDoc.data().email;
    if (!userEmail) {
      throw new HttpsError('failed-precondition', 'El usuario no tiene email');
    }
    
    const submissionsSnapshot = await db.collection('submissions')
      .where('status', 'in', ['published', 'accepted'])
      .get();
    
    let foundProfile = null;
    const crypto = require('crypto');
    
    submissionsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.authors && Array.isArray(data.authors)) {
        data.authors.forEach(author => {
          if (author.uid) return;
          
          if (author.email && author.email.toLowerCase() === userEmail.toLowerCase()) {
            const claimHash = crypto.createHash('sha256')
              .update(author.email + '-revista-secret')
              .digest('hex')
              .substring(0, 16);
            
            const name = `${author.firstName || ''} ${author.lastName || ''}`.trim();
            const anonymousUid = `anon-${generateSlug(name)}-${Date.now().toString(36)}`;
            
            foundProfile = {
              anonymousUid,
              name,
              claimHash,
              articles: [{
                title: data.title,
                submissionId: data.submissionId
              }]
            };
          }
        });
      }
    });
    
    if (foundProfile) {
      return {
        hasProfile: true,
        profile: foundProfile
      };
    } else {
      return {
        hasProfile: false
      };
    }
    
  } catch (error) {
    console.error('Error en checkAnonymousProfile:', error);
    throw new HttpsError('internal', error.message);
  }
});

/* ===================== CLAIM ANONYMOUS PROFILE ===================== */
exports.claimAnonymousProfile = onCall(
  { secrets: [GH_TOKEN] },
  async (request) => {
    const { HttpsError } = require("firebase-functions/v2/https");
    
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
      }
      
      const uid = request.auth.uid;
      const { anonymousUid, claimHash, anonymousName } = request.data;
      
      if (!anonymousUid || !claimHash || !anonymousName) {
        throw new HttpsError('invalid-argument', 'Faltan datos');
      }
      
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          throw new HttpsError('internal', 'Servicio GitHub no disponible');
        }
      }
      
      const db = admin.firestore();
      const crypto = require('crypto');
      
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Usuario no encontrado');
      }
      
      const userData = userDoc.data();
      const userEmail = userData.email;
      
      if (!userEmail) {
        throw new HttpsError('failed-precondition', 'El usuario no tiene email');
      }
      
      const expectedHash = crypto.createHash('sha256')
        .update(userEmail + '-revista-secret')
        .digest('hex')
        .substring(0, 16);
      
      if (expectedHash !== claimHash) {
        throw new HttpsError('permission-denied', 'Hash de verificación inválido');
      }
      
      const submissionsSnapshot = await db.collection('submissions')
        .where('status', 'in', ['published', 'accepted'])
        .get();
      
      const batch = db.batch();
      let articlesClaimed = 0;
      
      submissionsSnapshot.forEach(doc => {
        const data = doc.data();
        let modified = false;
        
        if (data.authors && Array.isArray(data.authors)) {
          const updatedAuthors = data.authors.map(author => {
            if (author.email && 
                author.email.toLowerCase() === userEmail.toLowerCase() && 
                !author.uid) {
              modified = true;
              articlesClaimed++;
              return {
                ...author,
                uid: uid,
                claimedAt: new Date().toISOString()
              };
            }
            return author;
          });
          
          if (modified) {
            batch.update(doc.ref, { authors: updatedAuthors });
          }
        }
      });
      
      batch.update(db.collection('users').doc(uid), {
        claimedAnonymousUid: anonymousUid,
        claimedAnonymousName: anonymousName,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        articlesClaimed: articlesClaimed,
        roles: admin.firestore.FieldValue.arrayUnion('Autor')
      });
      
      await batch.commit();
      
      console.log(`✅ Perfil reclamado: ${anonymousName} (${anonymousUid}) → ${uid} (${userEmail}) - ${articlesClaimed} artículos actualizados`);
      
      const octokit = getOctokit();
      
      await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
        owner: 'revista1919',
        repo: 'team',
        event_type: 'rebuild-team-claim',
        client_payload: {
          anonymousUid,
          userUid: uid,
          userEmail,
          anonymousName
        }
      });
      
      await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
        owner: 'revista1919',
        repo: 'revista1919.github.io',
        event_type: 'rebuild-articles-claim',
        client_payload: {
          userUid: uid,
          userEmail
        }
      });
      
      return {
        success: true,
        message: 'Perfil reclamado correctamente',
        articlesClaimed
      };
      
    } catch (error) {
      console.error('❌ Error en claimAnonymousProfile:', error);
      
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);

/* ===================== DRIVE HELPERS ===================== */
async function getDriveClient(requestId = 'unknown') {
  console.log(`[${requestId}] 🔧 Inicializando cliente de Drive...`);
  
  try {
    // Verificar que google esté disponible
    if (!google) {
      await loadDependencies();
      if (!google) {
        throw new Error('Google APIs no disponible');
      }
    }
    
    const clientId = OAUTH2_CLIENT_ID.value();
    const clientSecret = OAUTH2_CLIENT_SECRET.value();
    const refreshToken = OAUTH2_REFRESH_TOKEN.value();
    
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Faltan credenciales OAuth2');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    await oauth2Client.getAccessToken();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log(`[${requestId}] ✅ Drive inicializado correctamente`);
    return drive;
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error inicializando Drive:`, error.message);
    
    if (error.message.includes('invalid_grant')) {
      throw new Error('Refresh token inválido o expirado');
    }
    
    throw new Error(`Failed to initialize Drive: ${error.message}`);
  }
}
async function createDriveFolder(drive, folderName, parentId = null) {
  try {
    if (!folderName) throw new Error('folderName es requerido');
    if (!drive) throw new Error('Drive client no inicializado');

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    
    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, webViewLink, name'
    });
    
    if (!response.data.id) {
      throw new Error('No se recibió ID de la carpeta');
    }
    
    console.log(`✅ Carpeta creada: ${folderName} (${response.data.id})`);
    
    return response.data;

  } catch (error) {
    console.error(`❌ Error creando carpeta:`, error.message);
    throw new Error(`Failed to create folder: ${error.message}`);
  }
}

async function uploadToDrive(drive, fileBase64, fileName, folderId) {
  try {
    if (!fileBase64 || !fileName || !folderId) {
      throw new Error('Parámetros requeridos faltantes');
    }
    
    if (fileBase64.includes('base64,')) {
      fileBase64 = fileBase64.split('base64,')[1];
    }
    
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    
    const maxSize = 10 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`Archivo demasiado grande: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }
    
    const mimeType = fileName.endsWith('.docx') 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : fileName.endsWith('.doc')
        ? 'application/msword'
        : 'application/octet-stream';
    
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };
    
    const { Readable } = require('stream');
    const stream = Readable.from(fileBuffer);
    
    const media = {
      mimeType: mimeType,
      body: stream
    };
    
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, size, name'
    });
    
    if (!response.data.id) {
      throw new Error('No se recibió ID del archivo');
    }
    
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
    } catch (permError) {
      console.log(`⚠️ No se pudieron configurar permisos públicos`);
    }
    
    console.log(`✅ Archivo subido: ${fileName} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
    
    return response.data;
    
  } catch (error) {
    console.error(`❌ Error subiendo archivo:`, error.message);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

async function sendEmailViaExtension(to, subject, htmlBody) {
  try {
    if (!to || !subject || !htmlBody) {
      throw new Error('to, subject y htmlBody son requeridos');
    }
    
    const db = admin.firestore();
    const emailData = {
      to: [to],
      message: {
        subject: subject,
        html: htmlBody
      },
      // Agregar headers para desactivar tracking
      headers: {
        'X-Mailgun-Track': 'no',  // Para Mailgun
        'X-SMTPAPI': JSON.stringify({  // Para SendGrid
          filters: {
            clicktrack: {
              settings: {
                enable: 0
              }
            }
          }
        })
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('mail').add(emailData);
    console.log(`✅ Email encolado para: ${to}`);
  } catch (error) {
    console.error('❌ Error queueing email:', error.message);
  }
}

function getEmailTemplate(title, greeting, body, signatureName, signatureTitle, lang = 'es') {
  const journalName = lang === 'es' 
    ? 'Revista Nacional de las Ciencias para Estudiantes'
    : 'The National Review of Sciences for Students';
  
  const loginUrl = lang === 'es'
    ? 'https://www.revistacienciasestudiantes.com/es/login'
    : 'https://www.revistacienciasestudiantes.com/en/login';
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f3f4f6; padding-bottom: 40px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 4px; overflow: hidden; margin-top: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: #000000; padding: 40px 20px; text-align: center; border-bottom: 5px solid #007398; }
    .logo { width: 200px; height: auto; }
    .content { padding: 40px 50px; color: #1f2937; }
    .title-box { margin-bottom: 30px; }
    .main-title { font-family: 'Georgia', serif; font-size: 24px; font-weight: bold; color: #111827; margin: 0; line-height: 1.3; }
    .greeting { font-size: 16px; color: #4b5563; margin-bottom: 20px; }
    .body-text { font-size: 16px; line-height: 1.8; color: #374151; }
    .highlight-box { background-color: #f9fafb; border-left: 4px solid #007398; padding: 20px; margin: 25px 0; }
    .article-title { font-style: italic; font-weight: bold; color: #007398; margin: 0; font-size: 18px; }
    .button-container { text-align: center; margin: 35px 0; }
    .btn { background-color: #007398; color: #ffffff !important; padding: 14px 30px; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; display: inline-block; }
    .btn-secondary { background-color: #1f2937; margin-left: 10px; }
    .signature { margin-top: 40px; padding-top: 25px; border-top: 1px solid #e5e7eb; }
    .sig-name { font-weight: bold; color: #111827; margin: 0; font-size: 15px; }
    .sig-title { color: #6b7280; margin: 4px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    .footer { padding: 20px; text-align: center; color: #9ca3af; font-size: 11px; }
    .footer a { color: #007398; text-decoration: none; }
    .info-text { color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="https://www.revistacienciasestudiantes.com/assets/logo.png" alt="${journalName}" class="logo">
      </div>
      <div class="content">
        <div class="title-box">
          <h1 class="main-title">${title}</h1>
        </div>
        <p class="greeting">${greeting}</p>
        <div class="body-text">
          ${body}
        </div>
        <div class="signature">
          <p class="sig-name">${signatureName}</p>
          <p class="sig-title">${signatureTitle}</p>
        </div>
        <div class="info-text">
          <p>${lang === 'es' 
            ? 'Puedes seguir el estado de tu envío en nuestro portal:' 
            : 'You can track your submission status on our portal:'} 
            <a href="${loginUrl}">${loginUrl}</a>
          </p>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${journalName}.<br>
      ${lang === 'es' 
        ? 'Este es un correo institucional generado automáticamente.' 
        : 'This is an institutional automatically generated email.'}</p>
    </div>
  </div>
</body>
</html>`;
}

function isValidDocument(base64Header) {
  try {
    if (!base64Header || base64Header.length < 30) return false;
    
    const buffer = Buffer.from(base64Header.substring(0, 30), 'base64');
    const header = buffer.toString('hex').substring(0, 8);
    
    const docxSignature = '504b0304';
    const docSignature = 'd0cf11e0';
    
    return header.startsWith(docxSignature) || header.startsWith(docSignature);
  } catch {
    return false;
  }
}

function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

/* ===================== SUBMIT ARTICLE ===================== */
/* ===================== SUBMIT ARTICLE ===================== */
exports.submitArticle = onRequest(
  { 
    secrets: [OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN],
    cors: true,
    timeoutSeconds: 300,
    memory: '1GiB',
    minInstances: 0,
    maxInstances: 10
  },
  async (req, res) => {
    if (handleCors(req, res)) return;
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!validateOrigin(req)) {
      return res.status(403).json({ error: 'Origen no permitido' });
    }

    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[${requestId}] 🚀 Nuevo envío recibido`);
    
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const db = admin.firestore();
      
      const recentSubmissions = await db.collection('submissions')
        .where('ipAddress', '==', clientIp)
        .where('createdAt', '>', new Date(Date.now() - 60 * 60 * 1000))
        .count()
        .get();
      
      if (recentSubmissions.data().count > 5) {
        return res.status(429).json({ 
          error: 'Demasiados envíos. Intenta nuevamente en una hora.'
        });
      }

      const token = req.headers.authorization?.split('Bearer ')[1];
      if (!token) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
        console.log(`✅ Usuario autenticado: ${decodedToken.email}`);
      } catch (authError) {
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      const uid = decodedToken.uid;

      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};
      
      if (userData.submissionBlocked) {
        return res.status(403).json({ error: 'Cuenta bloqueada para envíos' });
      }

      // --- NUEVO: Extraer campos de disponibilidad ---
      const {
        title, titleEn, abstract, abstractEn, 
        keywords, keywordsEn, area, paperLanguage = 'es',
        authors, funding, conflictOfInterest,
        minorAuthors, excludedReviewers,
        manuscriptBase64, manuscriptName,
        authorEmail, authorName,
        articleType,
        acknowledgments,
        // NUEVOS CAMPOS
        dataAvailability,
        dataAvailabilityEn,
        codeAvailability,
        codeAvailabilityEn
      } = req.body;

      // NUEVO: Validar disponibilidad de datos (obligatorio)
      if (!dataAvailability) {
        return res.status(400).json({ 
          error: 'Debes declarar la disponibilidad de los datos',
          missingFields: ['dataAvailability']
        });
      }

      const requiredFields = { title, abstract, keywords, area, manuscriptBase64, authors, articleType };
      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value)
        .map(([key]) => key);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ error: 'Faltan campos requeridos', missingFields });
      }

      if (!Array.isArray(authors) || authors.length === 0) {
        return res.status(400).json({ error: 'Debe incluir al menos un autor' });
      }

      const authorEmailToUse = authorEmail || decodedToken.email;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(authorEmailToUse)) {
        return res.status(400).json({ error: 'Email de autor inválido' });
      }

      const fileSizeInBytes = Buffer.from(manuscriptBase64, 'base64').length;
      const maxSize = 10 * 1024 * 1024;
      
      if (fileSizeInBytes > maxSize) {
        return res.status(400).json({ 
          error: `El archivo excede el tamaño máximo de 10MB`
        });
      }

      if (!isValidDocument(manuscriptBase64.substring(0, 100))) {
        return res.status(400).json({ 
          error: 'El archivo no es un documento Word válido (.doc o .docx)'
        });
      }

      const submissionId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      console.log(`📄 Submission ID: ${submissionId}`);

      // Verificar que google esté disponible - con reintentos
      let googleAvailable = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!googleAvailable && attempts < maxAttempts) {
        if (!google) {
          console.log(`[${requestId}] ⏳ Intento ${attempts + 1}/${maxAttempts}: Cargando dependencias de Google Drive...`);
          await loadDependencies();
        }
        
        if (google) {
          googleAvailable = true;
          console.log(`[${requestId}] ✅ Google Drive disponible después de ${attempts + 1} intentos`);
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!googleAvailable) {
        console.error(`[${requestId}] ❌ Google Drive no disponible después de ${maxAttempts} intentos`);
        return res.status(500).json({ 
          error: 'Servicio Google Drive no disponible',
          requestId
        });
      }

      let drive;
      try {
        drive = await getDriveClient(requestId);
      } catch (driveError) {
        console.error(`[${requestId}] ❌ Error obteniendo cliente Drive:`, driveError);
        return res.status(500).json({ 
          error: 'Error en servicio de almacenamiento',
          requestId
        });
      }

      const safeTitle = title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
      
      // --- MODIFICADO: Crear DOS carpetas ---
      // Carpeta 1: Para el autor (documentos originales)
      const authorFolderName = `AUTHOR_${submissionId}_${safeTitle}`;
      let authorFolder;
      try {
        authorFolder = await createDriveFolder(drive, authorFolderName);
        console.log(`✅ Carpeta de autor creada: ${authorFolderName} (${authorFolder.id})`);
      } catch (folderError) {
        return res.status(500).json({ 
          error: 'Error creando carpeta de autor en Drive',
          requestId
        });
      }

      // Carpeta 2: Para editores (revisión editorial) - NUEVA
      const editorialFolderName = `EDITORIAL_${submissionId}_${safeTitle}`;
      let editorialFolder;
      try {
        editorialFolder = await createDriveFolder(drive, editorialFolderName);
        console.log(`✅ Carpeta editorial creada: ${editorialFolderName} (${editorialFolder.id})`);
      } catch (folderError) {
        // Si falla la carpeta editorial, no detenemos el proceso pero registramos el error
        console.error(`⚠️ Error creando carpeta editorial:`, folderError.message);
        editorialFolder = null;
      }

      const fileExt = manuscriptName?.endsWith('.docx') ? '.docx' : '.doc';
      const fileName = `ORIGINAL_${submissionId}${fileExt}`;

      let file;
      try {
        // Subir a la carpeta del autor
        file = await uploadToDrive(drive, manuscriptBase64, fileName, authorFolder.id);
        console.log(`✅ Archivo subido a carpeta de autor`);
      } catch (uploadError) {
        return res.status(500).json({ 
          error: 'Error subiendo archivo a Drive',
          requestId
        });
      }

      // Si hay carpeta editorial, crear un acceso directo simbólico o copiar referencia
      if (editorialFolder) {
        try {
          // Crear un atajo (shortcut) en la carpeta editorial que apunte al archivo original
          await drive.files.create({
            resource: {
              name: `[REF] ${fileName}`,
              mimeType: 'application/vnd.google-apps.shortcut',
              parents: [editorialFolder.id],
              shortcutDetails: {
                targetId: file.id
              }
            },
            fields: 'id'
          });
          console.log(`✅ Acceso directo creado en carpeta editorial`);
        } catch (shortcutError) {
          console.error(`⚠️ Error creando acceso directo:`, shortcutError.message);
        }
      }

      console.log('🔒 Configurando permisos restringidos para editores...');

      const editorSnapshotForPermissions = await db.collection('users')
        .where('roles', 'array-contains-any', ['Director General', 'Editor en Jefe'])
        .get();

      const editorEmailsForPermissions = [];
      editorSnapshotForPermissions.forEach(doc => {
        const data = doc.data();
        if (data.email) editorEmailsForPermissions.push(data.email);
      });

      if (editorEmailsForPermissions.length === 0) {
        editorEmailsForPermissions.push('contact@revistacienciasestudiantes.com');
      }

      // --- MODIFICADO: Otorgar permisos a AMBAS carpetas ---
      // Permisos para carpeta de autor (solo lectura para editores)
      for (const email of editorEmailsForPermissions) {
        try {
          await drive.permissions.create({
            fileId: authorFolder.id,
            requestBody: {
              role: 'reader',
              type: 'user',
              emailAddress: email
            },
            sendNotificationEmail: false
          });
        } catch (permErr) {
          console.error(`❌ Error permiso lectura para ${email} en carpeta autor:`, permErr.message);
        }
      }

      // Permisos para carpeta editorial (escritura para editores)
      if (editorialFolder) {
        for (const email of editorEmailsForPermissions) {
          try {
            await drive.permissions.create({
              fileId: editorialFolder.id,
              requestBody: {
                role: 'writer',
                type: 'user',
                emailAddress: email
              },
              sendNotificationEmail: false
            });
            console.log(`✅ Permiso writer otorgado a editor: ${email} en carpeta editorial`);
          } catch (permErr) {
            console.error(`❌ Error permiso para ${email} en carpeta editorial:`, permErr.message);
          }
        }
      }

      // Permiso para el autor en su propia carpeta (escritura)
      try {
        await drive.permissions.create({
          fileId: authorFolder.id,
          requestBody: {
            role: 'reader',
            type: 'user',
            emailAddress: decodedToken.email
          },
          sendNotificationEmail: false
        });
        console.log(`✅ Permiso writer otorgado a autor: ${decodedToken.email}`);
      } catch (permErr) {
        console.error(`❌ Error permiso para autor:`, permErr.message);
      }

      const crypto = require('crypto');
      const fileBuffer = Buffer.from(manuscriptBase64, 'base64');
      const integrityHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const processedAuthors = [];
      const consentFiles = [];

      for (const author of authors) {
        const authorData = {
          firstName: sanitizeText(author.firstName),
          lastName: sanitizeText(author.lastName),
          email: author.email,
          institution: sanitizeText(author.institution),
          orcid: author.orcid || null,
          contribution: sanitizeText(author.contribution || ''),
          isMinor: Boolean(author.isMinor),
          guardianName: author.isMinor ? sanitizeText(author.guardianName) : null,
          isCorresponding: Boolean(author.isCorresponding)
        };

        if (!emailRegex.test(author.email)) {
          return res.status(400).json({ 
            error: `Email inválido para autor: ${author.firstName} ${author.lastName}`
          });
        }

        processedAuthors.push(authorData);
      }

      if (Array.isArray(minorAuthors)) {
        for (const minor of minorAuthors) {
          if (minor.consentMethod === 'upload' && minor.consentFile?.data) {
            try {
              const consentFileName = `CONSENT_${minor.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
              // Subir consentimiento a la carpeta del autor
              const consentFile = await uploadToDrive(
                drive, 
                minor.consentFile.data, 
                consentFileName, 
                authorFolder.id
              );

              consentFiles.push({
                author: minor.name,
                fileId: consentFile.id,
                fileUrl: consentFile.webViewLink,
                method: 'upload'
              });
            } catch (consentError) {
              console.error(`Error subiendo consentimiento de ${minor.name}:`, consentError);
              consentFiles.push({
                author: minor.name,
                method: 'upload',
                error: consentError.message
              });
            }
          } else if (minor.consentMethod === 'email') {
            consentFiles.push({
              author: minor.name,
              method: 'email',
              note: 'Consentimiento enviado por correo a contact@revistacienciasestudiantes.com'
            });
          }
        }
      }

      const sanitizedMinorAuthors = (minorAuthors || []).map(m => ({
        name: sanitizeText(m.name),
        guardianName: sanitizeText(m.guardianName),
        consentMethod: m.consentMethod
      }));

      // --- MODIFICADO: Añadir nuevos campos a submissionData ---
      const submissionData = {
        submissionId,
        uid,
        authorUID: uid,
        authorEmail: authorEmailToUse,
        authorName: authorName || `${authors[0].firstName} ${authors[0].lastName}`.trim(),
        
        title: sanitizeText(title),
        titleEn: titleEn ? sanitizeText(titleEn) : null,
        abstract: sanitizeText(abstract),
        abstractEn: abstractEn ? sanitizeText(abstractEn) : null,
        keywords: keywords.split(';').map(k => sanitizeText(k.trim())).filter(Boolean),
        keywordsEn: keywordsEn ? keywordsEn.split(';').map(k => sanitizeText(k.trim())).filter(Boolean) : [],
        area: sanitizeText(area),
        paperLanguage: paperLanguage === 'en' ? 'en' : 'es',
        
        articleType: articleType ? sanitizeText(articleType) : null,
        acknowledgments: acknowledgments ? sanitizeText(acknowledgments) : '',
        
        // NUEVO: Disponibilidad de datos y código
        dataAvailability: sanitizeText(dataAvailability),
        dataAvailabilityEn: dataAvailabilityEn ? sanitizeText(dataAvailabilityEn) : null,
        codeAvailability: codeAvailability ? sanitizeText(codeAvailability) : null,
        codeAvailabilityEn: codeAvailabilityEn ? sanitizeText(codeAvailabilityEn) : null,
        
        authors: processedAuthors,
        
        funding: funding || { hasFunding: false, sources: '', grantNumbers: '' },
        conflictOfInterest: conflictOfInterest ? sanitizeText(conflictOfInterest) : '',
        
        hasMinorAuthors: processedAuthors.some(a => a.isMinor),
        minorAuthors: sanitizedMinorAuthors,
        consentFiles,
        
        excludedReviewers: excludedReviewers 
          ? excludedReviewers.split(';').map(r => sanitizeText(r.trim())).filter(Boolean)
          : [],
        
        originalFileId: file.id,
        originalFileUrl: file.webViewLink,
        originalFileName: fileName,
        originalFileHash: integrityHash,
        originalFileSize: fileBuffer.length,
        
        // MODIFICADO: Guardar AMBAS carpetas
        driveFolderId: authorFolder.id,
        driveFolderUrl: authorFolder.webViewLink,
        editorialFolderId: editorialFolder ? editorialFolder.id : null,
        editorialFolderUrl: editorialFolder ? editorialFolder.webViewLink : null,
        
        status: 'submitted',
        currentRound: 1,
        
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        
        userAgent: req.headers['user-agent'] || null,
        ipAddress: clientIp,
        requestId
      };

      await db.runTransaction(async (transaction) => {
        transaction.set(db.collection('submissions').doc(submissionId), submissionData);
        
        transaction.set(db.collection('submissions').doc(submissionId).collection('versions').doc(), {
          version: 1,
          fileId: file.id,
          fileUrl: file.webViewLink,
          fileName,
          fileHash: integrityHash,
          fileSize: fileBuffer.length,
          type: 'original',
          uploadedBy: uid,
          uploadedByEmail: decodedToken.email,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        transaction.set(db.collection('submissions').doc(submissionId).collection('auditLogs').doc(), {
          action: 'submission_created',
          by: uid,
          byEmail: decodedToken.email,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        transaction.update(db.collection('users').doc(uid), {
          totalSubmissions: admin.firestore.FieldValue.increment(1),
          lastSubmissionAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      console.log(`✅ Datos guardados en Firestore`);

      const editors = [];
      const usersSnapshot = await db.collection('users')
        .where('roles', 'array-contains-any', ['Director General', 'Editor en Jefe'])
        .limit(20)
        .get();
      
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        if (user.email) {
          editors.push({
            email: user.email,
            name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Editor',
            role: user.roles.includes('Director General') ? 'Director General' : 'Editor en Jefe'
          });
        }
      });

      const editorEmails = editors.length > 0 ? editors : [
        { email: 'contact@revistacienciasestudiantes.com', name: 'Director General', role: 'Director General' }
      ];

      const emailPromises = [];

      for (const editor of editorEmails) {
        const authorsList = authors.map(a => 
          `• ${a.firstName} ${a.lastName} (${a.email})${a.isMinor ? ' [MENOR]' : ''}`
        ).join('<br>');

        const minorInfo = processedAuthors.some(a => a.isMinor) 
          ? `<p style="color: #b45309;">⚠️ Incluye autores menores - Revisar consentimientos</p>`
          : '';

        const fundingInfo = funding?.hasFunding 
          ? `<p><strong>Financiación:</strong> ${funding.sources || 'Sí'}</p>`
          : '';

        // NUEVO: Incluir disponibilidad en el email
        const availabilityInfo = `
          <p><strong>Disponibilidad de datos:</strong> ${dataAvailability}</p>
          ${codeAvailability ? `<p><strong>Disponibilidad de código:</strong> ${codeAvailability}</p>` : ''}
        `;

        const articleInfo = `
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            ${minorInfo}
            <p><strong>ID:</strong> ${submissionId}</p>
            <p><strong>Autor:</strong> ${sanitizeText(authorName)}</p>
            <p><strong>Email:</strong> ${authorEmailToUse}</p>
            <p><strong>Área:</strong> ${sanitizeText(area)}</p>
            <p><strong>Tipo de artículo:</strong> ${articleType ? articleType.toUpperCase() : 'No especificado'}</p>
            <p><strong>Idioma:</strong> ${paperLanguage === 'es' ? 'Español' : 'Inglés'}</p>
            ${fundingInfo}
            ${availabilityInfo}
            <p><strong>Autores (${authors.length}):</strong><br>${authorsList}</p>
          </div>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">VER EN PORTAL</a>
            <a href="${authorFolder.webViewLink}" class="btn btn-secondary">CARPETA AUTOR</a>
            ${editorialFolder ? `<a href="${editorialFolder.webViewLink}" class="btn btn-secondary">CARPETA EDITORIAL</a>` : ''}
          </div>
          
          <p class="info-text">
            <strong>Manuscrito:</strong> <a href="${file.webViewLink}">${fileName}</a><br>
            <strong>Tamaño:</strong> ${(fileBuffer.length / 1024).toFixed(2)}KB
          </p>
        `;

        const htmlBody = getEmailTemplate(
          '📬 Nuevo Artículo Recibido',
          `Estimado/a ${editor.name}:`,
          articleInfo,
          'Sistema Editorial',
          'Revista Nacional de las Ciencias para Estudiantes',
          'es'
        );

        emailPromises.push(
          sendEmailViaExtension(
            editor.email,
            `📄 Nuevo artículo: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`,
            htmlBody
          ).catch(err => console.log(`⚠️ Error email to ${editor.email}`))
        );
      }

      const authorEmailTitle = paperLanguage === 'es' 
        ? '✅ Confirmación de envío'
        : '✅ Submission confirmation';

      const authorGreeting = paperLanguage === 'es'
        ? `Estimado/a ${authorName}:`
        : `Dear ${authorName}:`;

      let minorMessage = '';
      if (processedAuthors.some(a => a.isMinor)) {
        minorMessage = paperLanguage === 'es'
          ? `<p style="background-color: #fffbeb; padding: 15px; border-left: 4px solid #d97706;">
               <strong>📋 IMPORTANTE - AUTOR MENOR:</strong><br>
               Hemos recibido los documentos de consentimiento.
             </p>`
          : `<p style="background-color: #fffbeb; padding: 15px; border-left: 4px solid #d97706;">
               <strong>📋 IMPORTANT - MINOR AUTHOR:</strong><br>
               We have received the consent documents.
             </p>`;
      }

      // NUEVO: Información de disponibilidad para el autor
      const availabilityMessage = paperLanguage === 'es'
        ? `
          <div class="highlight-box" style="background-color: #f0f7ff; border-left-color: #0A1929;">
            <p><strong>📊 Disponibilidad de datos:</strong> ${dataAvailability}</p>
            ${codeAvailability ? `<p><strong>💻 Disponibilidad de código:</strong> ${codeAvailability}</p>` : ''}
          </div>
        `
        : `
          <div class="highlight-box" style="background-color: #f0f7ff; border-left-color: #0A1929;">
            <p><strong>📊 Data availability:</strong> ${dataAvailability}</p>
            ${codeAvailability ? `<p><strong>💻 Code availability:</strong> ${codeAvailability}</p>` : ''}
          </div>
        `;

      const authorBody = paperLanguage === 'es'
        ? `
          ${minorMessage}
          ${availabilityMessage}
          
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            <p><strong>ID de envío:</strong> ${submissionId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
          </div>
          
          <p>Hemos recibido tu artículo correctamente. El proceso de revisión comenzará en los próximos días.</p>
          
          <p><strong>Próximos pasos:</strong></p>
          <ol>
            <li>Revisión editorial inicial</li>
            <li>Asignación de revisores</li>
            <li>Revisión por pares</li>
          </ol>
          
          <p><strong>Tus documentos:</strong></p>
<ul>
  <li><a href="${authorFolder.webViewLink}">📁 Carpeta personal</a> (tus documentos originales)</li>
</ul>
          
          <p><em>Nota: Los plazos de revisión dependen de la disponibilidad de los revisores y de la complejidad del artículo, por lo que no son fijos. Te mantendremos informado de cualquier avance.</em></p>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">VER ESTADO</a>
          </div>
        `
        : `
          ${minorMessage}
          ${availabilityMessage}
          
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            <p><strong>Submission ID:</strong> ${submissionId}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
          </div>
          
          <p>We have received your article successfully. The review process will begin in the coming days.</p>
          
          <p><strong>Next steps:</strong></p>
          <ol>
            <li>Initial editorial review</li>
            <li>Reviewer assignment</li>
            <li>Peer review</li>
          </ol>
          
          <p><strong>Your Google Drive folders:</strong></p>
          <ul>
            <li><a href="${authorFolder.webViewLink}">📁 Personal folder</a> (your original documents)</li>
            ${editorialFolder ? `<li><a href="${editorialFolder.webViewLink}">📋 Editorial folder</a> (review tracking)</li>` : ''}
          </ul>
          
          <p><em>Note: Review timelines depend on reviewer availability and article complexity, so they are not fixed. We will keep you updated on any progress.</em></p>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/en/login" class="btn">CHECK STATUS</a>
          </div>
        `;

      const authorHtmlBody = getEmailTemplate(
        authorEmailTitle,
        authorGreeting,
        authorBody,
        paperLanguage === 'es' ? 'Equipo Editorial' : 'Editorial Team',
        paperLanguage === 'es' ? 'Revista Nacional de las Ciencias para Estudiantes' : 'National Review of Sciences for Students',
        paperLanguage
      );

      emailPromises.push(
        sendEmailViaExtension(
          authorEmailToUse,
          paperLanguage === 'es' ? 'Confirmación de envío' : 'Submission confirmation',
          authorHtmlBody
        ).catch(err => console.log(`⚠️ Error email to author`))
      );

      Promise.allSettled(emailPromises);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Envío exitoso: ${submissionId} (${processingTime}ms)`);

      // MODIFICADO: Devolver URLs de ambas carpetas
      return res.status(201).json({
        success: true,
        submissionId,
        driveFolderUrl: authorFolder.webViewLink,
        editorialFolderUrl: editorialFolder ? editorialFolder.webViewLink : null,
        message: paperLanguage === 'es' 
          ? 'Artículo enviado correctamente'
          : 'Article submitted successfully',
        requestId
      });

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'submitArticle',
          error: { message: error.message, stack: error.stack },
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {}
      
      return res.status(500).json({
        error: 'Error interno del servidor',
        requestId
      });
    }
  }
);
/* ===================== GET USER SUBMISSIONS ===================== */
exports.getUserSubmissions = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    
    const uid = request.auth.uid;
    const db = admin.firestore();
    
    const { limit = 20, startAfter } = request.data;
    
    let query = db.collection('submissions')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 50));
    
    if (startAfter) {
      const startAfterDoc = await db.collection('submissions').doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }
    
    const submissionsSnapshot = await query.get();
    
    const submissions = [];
    let lastDocId = null;
    
    submissionsSnapshot.forEach(doc => {
      const data = doc.data();
      submissions.push({
        id: doc.id,
        submissionId: data.submissionId,
        title: data.title,
        status: data.status,
        createdAt: data.createdAt?.toDate()?.toISOString(),
        area: data.area,
        paperLanguage: data.paperLanguage,
        articleType: data.articleType
      });
      lastDocId = doc.id;
    });
    
    return {
      success: true,
      submissions,
      count: submissions.length,
      hasMore: submissions.length === limit,
      lastDocId: submissions.length === limit ? lastDocId : null
    };
    
  } catch (error) {
    console.error('Error en getUserSubmissions:', error.message);
    
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Error al obtener envíos');
  }
});

/* ===================== CHECK SUBMISSION STATUS ===================== */
exports.checkSubmissionStatus = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  
  try {
    const { submissionId } = request.data;
    
    if (!submissionId) {
      throw new HttpsError('invalid-argument', 'Se requiere submissionId');
    }
    
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    
    const db = admin.firestore();
    const uid = request.auth.uid;
    
    const submissionDoc = await db.collection('submissions').doc(submissionId).get();
    
    if (!submissionDoc.exists) {
      throw new HttpsError('not-found', 'Envío no encontrado');
    }
    
    const submission = submissionDoc.data();
    
    const userDoc = await db.collection('users').doc(uid).get();
    const userRoles = userDoc.data()?.roles || [];
    const isEditor = userRoles.includes('Director General') || userRoles.includes('Editor en Jefe');
    const isOwner = submission.uid === uid;
    
    if (!isOwner && !isEditor) {
      throw new HttpsError('permission-denied', 'No tienes permiso');
    }
    
    const logsSnapshot = await db.collection('submissions').doc(submissionId)
      .collection('auditLogs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    
    const logs = [];
    logsSnapshot.forEach(doc => {
      const log = doc.data();
      logs.push({
        ...log,
        id: doc.id,
        timestamp: log.timestamp?.toDate()?.toISOString()
      });
    });
    
    const response = {
      success: true,
      submission: {
        id: submissionDoc.id,
        submissionId: submission.submissionId,
        title: submission.title,
        abstract: submission.abstract,
        keywords: submission.keywords,
        area: submission.area,
        paperLanguage: submission.paperLanguage,
        articleType: submission.articleType,
        acknowledgments: submission.acknowledgments,
        status: submission.status,
        currentRound: submission.currentRound,
        createdAt: submission.createdAt?.toDate()?.toISOString(),
        updatedAt: submission.updatedAt?.toDate()?.toISOString(),
        hasMinorAuthors: submission.hasMinorAuthors,
        driveFolderUrl: submission.driveFolderUrl
      },
      recentLogs: logs
    };
    
    if (isOwner || isEditor) {
      response.submission.authors = submission.authors;
      response.submission.originalFileUrl = submission.originalFileUrl;
      response.submission.consentFiles = submission.consentFiles;
    }
    
    return response;
    
  } catch (error) {
    console.error('Error en checkSubmissionStatus:', error.message);
    
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});

exports.onEditorialReviewCreated = onDocumentCreated(
  {
    document: 'editorialReviews/{reviewId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const reviewData = event.data.data();
    const reviewId = event.params.reviewId;

    console.log(`📝 [onEditorialReviewCreated] Nueva revisión editorial creada: ${reviewId} para envío: ${reviewData.submissionId}`);

    try {
      const db = admin.firestore();
      const submissionRef = db.collection('submissions').doc(reviewData.submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        console.error(`❌ Submission no encontrado: ${reviewData.submissionId}`);
        return;
      }

      // Actualizar el estado del envío
      await submissionRef.update({
        status: 'in-editorial-review',
        currentEditorialReviewId: reviewId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // --- NUEVO: Si hay una tarea asociada, actualizarla ---
      if (reviewData.editorialTaskId) {
        const taskRef = db.collection('editorialTasks').doc(reviewData.editorialTaskId);
        await taskRef.update({
          status: 'in-progress',
          currentReviewId: reviewId,
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Tarea editorial ${reviewData.editorialTaskId} actualizada a 'in-progress'`);
      }

      console.log(`✅ Estado de envío ${reviewData.submissionId} actualizado a 'in-editorial-review'`);

    } catch (error) {
      console.error(`❌ [onEditorialReviewCreated] Error:`, error.message);
      await logSystemError('onEditorialReviewCreated', error, { reviewId, ...reviewData });
    }
  }
);
/* ----------------------------------------------------------------------------
 * 2. TRIGGER: Cuando se ACTUALIZA una editorialReview (se guarda la decisión)
 * ----------------------------------------------------------------------------
 * Esta función es la CLAVE. Cuando el editor guarda su decisión en Firestore,
 * este trigger se activa, procesa la decisión y actualiza el estado del envío.
 */
/* ===================== ON EDITORIAL REVIEW UPDATED - VERSIÓN CORREGIDA ===================== */
exports.onEditorialReviewUpdated = onDocumentUpdated(
  {
    document: 'editorialReviews/{reviewId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const reviewId = event.params.reviewId;

    // Solo proceder si la decisión ha cambiado y ahora NO es null
    if (beforeData.decision === afterData.decision || afterData.decision === null) {
      return;
    }

    console.log(`📝 [onEditorialReviewUpdated] Decisión tomada para revisión ${reviewId}: ${afterData.decision}`);

    try {
      const db = admin.firestore();
      
      // ===== 1. Obtener referencias =====
      const submissionRef = db.collection('submissions').doc(afterData.submissionId);
      const submissionSnap = await submissionRef.get();

      if (!submissionSnap.exists) {
        console.error(`❌ Envío no encontrado: ${afterData.submissionId}`);
        return;
      }

      const submissionData = submissionSnap.data();
      let taskRef = null;
      let taskData = null;

      // Si hay una tarea editorial asociada, obtenerla
      if (afterData.editorialTaskId) {
        taskRef = db.collection('editorialTasks').doc(afterData.editorialTaskId);
        const taskSnap = await taskRef.get();
        if (taskSnap.exists) {
          taskData = taskSnap.data();
        }
      }

      // ===== 2. Determinar nuevos estados según la decisión =====
      let newTaskStatus = null;
      let newSubmissionStatus = null;
      let emailHtml = '';
      const lang = submissionData.paperLanguage || 'es';
      const authorName = submissionData.authorName || 'Autor';

      switch (afterData.decision) {
        case 'reject':
          // Rechazo en desk review - proceso termina
          newTaskStatus = 'completed';
          newSubmissionStatus = 'rejected';
          emailHtml = getRejectionEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName);
          break;

        case 'minor-revision':
          // Si permitimos revisiones menores directamente desde desk review
          newTaskStatus = 'completed';
          newSubmissionStatus = 'minor-revision-required';
          emailHtml = getRevisionEmailBody(afterData.feedbackToAuthor, submissionData.title, 'minor', lang, authorName);
          break;

        case 'revision-required':
          // Pasa a revisión por pares - la tarea CONTINÚA
          newTaskStatus = 'reviewer-selection'; // NO completada
          newSubmissionStatus = 'in-reviewer-selection';
          emailHtml = getPeerReviewStartEmailBody(submissionData.title, lang, authorName);
          break;

        case 'accept':
          // Aceptado directamente desde desk review
          newTaskStatus = 'completed';
          newSubmissionStatus = 'accepted';
          emailHtml = getAcceptanceEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName);
          break;

        default:
          console.warn(`⚠️ Decisión desconocida: ${afterData.decision}`);
          return;
      }

      // ===== 3. Actualizar el SUBMISSION =====
      const submissionUpdateData = {
        status: newSubmissionStatus,
        deskReviewDecision: afterData.decision,
        deskReviewFeedback: afterData.feedbackToAuthor || '',
        deskReviewCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await submissionRef.update(submissionUpdateData);
      console.log(`✅ Submission ${afterData.submissionId} actualizado a estado: ${newSubmissionStatus}`);

      // ===== 4. Actualizar la TAREA EDITORIAL (si existe) =====
      if (taskRef && newTaskStatus) {
        const taskUpdateData = {
          deskReviewDecision: afterData.decision,
          deskReviewFeedback: afterData.feedbackToAuthor || '',
          deskReviewComments: afterData.commentsToEditorial || '',
          deskReviewCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Solo cambiar el estado si es diferente
        if (newTaskStatus) {
          taskUpdateData.status = newTaskStatus;
        }

        await taskRef.update(taskUpdateData);
        console.log(`✅ Tarea editorial ${afterData.editorialTaskId} actualizada a estado: ${newTaskStatus}`);
      }

      // ===== 5. Enviar email al autor =====
      if (emailHtml && submissionData.authorEmail) {
        const emailSubject = lang === 'es' 
          ? 'Actualización sobre su envío - Revista Nacional de las Ciencias' 
          : 'Update on your submission - National Review of Sciences';
        
        await sendEmailViaExtension(submissionData.authorEmail, emailSubject, emailHtml);
        console.log(`✅ Email enviado a autor: ${submissionData.authorEmail}`);
      }

      // ===== 6. Registrar en audit log =====
      await db.collection('submissions').doc(afterData.submissionId)
        .collection('auditLogs').add({
          action: 'desk_review_completed',
          decision: afterData.decision,
          by: afterData.editorUid || 'system',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      console.log(`✅ Proceso completado para revisión ${reviewId}`);

    } catch (error) {
      console.error(`❌ [onEditorialReviewUpdated] Error:`, error.message);
      console.error(error.stack);
      await logSystemError('onEditorialReviewUpdated', error, { 
        reviewId, 
        submissionId: afterData?.submissionId,
        decision: afterData?.decision 
      });
    }
  }
);
/* ----------------------------------------------------------------------------
 * 3. TRIGGER: Cuando se CREA una nueva reviewerInvitation
 * ----------------------------------------------------------------------------
 * Esta función ya la tienes, pero la mejoramos para que sea más robusta
 * y use la función de email mejorada.
 */
exports.onReviewerInvitationCreated = onDocumentCreated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [], // Los emails se manejan con la extensión, no necesitan secret aquí
    memory: '256MiB'
  },
  async (event) => {
    const invitation = event.data.data();
    const invitationId = event.params.invitationId;

    console.log(`📧 [onReviewerInvitationCreated] Procesando nueva invitación: ${invitationId} para ${invitation.reviewerEmail}`);

    try {
      const db = admin.firestore();

      // Obtener detalles del submission
      const submissionDoc = await db.collection('submissions').doc(invitation.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ [onReviewerInvitationCreated] Submission no encontrado: ${invitation.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();

      // Determinar idioma (usar el del artículo o 'es' por defecto)
      const lang = submission.paperLanguage || 'es';
      const isSpanish = lang === 'es';

      // Construir el enlace de respuesta
      const baseUrl = 'https://www.revistacienciasestudiantes.com';
      const inviteLink = `${baseUrl}/reviewer-response?hash=${invitation.inviteHash}&lang=${lang}`;

      // --- Construir el cuerpo del email (usando tu función getEmailTemplate) ---
      const emailTitle = isSpanish
        ? '📋 Invitación a revisión por pares'
        : '📋 Peer Review Invitation';

      const emailGreeting = isSpanish
        ? `Estimado/a ${invitation.reviewerName || 'colega'}:`
        : `Dear ${invitation.reviewerName || 'colleague'}:`;

      const articleInfo = `
        <div class="highlight-box">
          <p class="article-title">"${submission.title}"</p>
          <p><strong>${isSpanish ? 'Área:' : 'Area:'}</strong> ${submission.area}</p>
          <p><strong>${isSpanish ? 'Resumen:' : 'Abstract:'}</strong> ${submission.abstract.substring(0, 250)}${submission.abstract.length > 250 ? '...' : ''}</p>
        </div>
      `;

      const emailBodyContent = isSpanish
        ? `
          <p>Has sido invitado/a a revisar el siguiente artículo para la Revista Nacional de las Ciencias para Estudiantes.</p>
          ${articleInfo}
          <p>Para aceptar o rechazar esta invitación, y declarar cualquier conflicto de interés, haz clic en el siguiente enlace:</p>
          <div class="button-container">
            <a href="${inviteLink}" class="btn">RESPONDER INVITACIÓN</a>
          </div>
          <p><strong>Plazo para responder:</strong> 7 días.</p>
        `
        : `
          <p>You have been invited to review the following article for The National Review of Sciences for Students.</p>
          ${articleInfo}
          <p>To accept or decline this invitation, and to declare any conflict of interest, please click the link below:</p>
          <div class="button-container">
            <a href="${inviteLink}" class="btn">RESPOND TO INVITATION</a>
          </div>
          <p><strong>Response deadline:</strong> 7 days.</p>
        `;

      const htmlBody = getEmailTemplate(
        emailTitle,
        emailGreeting,
        emailBodyContent,
        isSpanish ? 'Equipo Editorial' : 'Editorial Team',
        isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
        lang
      );

      // Encolar el email
      await sendEmailViaExtension(
        invitation.reviewerEmail,
        isSpanish ? 'Invitación a revisión por pares' : 'Peer Review Invitation',
        htmlBody
      );

      console.log(`✅ [onReviewerInvitationCreated] Email encolado para: ${invitation.reviewerEmail}`);

      // Marcar la invitación como enviada
      await event.data.ref.update({
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteLink: inviteLink
      });

    } catch (error) {
      console.error(`❌ [onReviewerInvitationCreated] Error:`, error.message);
      await logSystemError('onReviewerInvitationCreated', error, { invitationId, ...invitation });
    }
  }
);

/* ----------------------------------------------------------------------------
 * 4. TRIGGER: Cuando un revisor RESPONDE a una invitación (se actualiza)
 * ----------------------------------------------------------------------------
 */
exports.onReviewerInvitationUpdated = onDocumentUpdated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invitationId = event.params.invitationId;

    // Solo proceder si el estado cambió de 'pending' a algo más
    if (beforeData.status !== 'pending' || afterData.status === 'pending') {
      return;
    }

    console.log(`📝 [onReviewerInvitationUpdated] Invitación ${invitationId} respondida. Nuevo estado: ${afterData.status}`);

    try {
      const db = admin.firestore();

      // Si el revisor ACEPTÓ, crear una asignación (reviewerAssignment)
      if (afterData.status === 'accepted') {
        const assignmentData = {
          submissionId: afterData.submissionId,
          editorialReviewId: afterData.editorialReviewId,
          round: afterData.round,
          reviewerUid: afterData.reviewerUid, // <-- Esto debe ser llenado por el frontend al responder si el usuario está logueado, o ser null si es anónimo.
          reviewerEmail: afterData.reviewerEmail,
          reviewerName: afterData.reviewerName,
          invitationId: invitationId,
          status: 'pending', // Asignado, pero aún no ha enviado su revisión
          conflictOfInterest: afterData.conflictOfInterest,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) // Plazo de 3 semanas
        };

        await db.collection('reviewerAssignments').add(assignmentData);
        console.log(`✅ [onReviewerInvitationUpdated] Asignación creada para revisor ${afterData.reviewerEmail}`);

        // Opcional: Enviar email al revisor con instrucciones y acceso al documento
        // (Aquí podrías enviar otro email con el enlace al documento en Drive)
        await sendReviewerAssignmentEmail(afterData);

      } else if (afterData.status === 'declined') {
        console.log(`ℹ️ [onReviewerInvitationUpdated] Revisor ${afterData.reviewerEmail} declinó la invitación.`);
        // Opcional: Notificar al editor que la invitación fue declinada
      }

    } catch (error) {
      console.error(`❌ [onReviewerInvitationUpdated] Error:`, error.message);
      await logSystemError('onReviewerInvitationUpdated', error, { invitationId, ...afterData });
    }
  }
);


// ============================================================================
// ==================== FUNCIONES AUXILIARES PARA EMAILS ====================
// ============================================================================

async function sendReviewerAssignmentEmail(assignment) {
  // Esta función enviaría un email al revisor que aceptó, con el enlace al manuscrito.
  // Necesitarías obtener la URL del driveFolder del submission.
  const db = admin.firestore();
  const submissionSnap = await db.collection('submissions').doc(assignment.submissionId).get();
  if (!submissionSnap.exists) return;

  const submission = submissionSnap.data();
  const lang = submission.paperLanguage || 'es';
  const isSpanish = lang === 'es';
  const baseUrl = 'https://www.revistacienciasestudiantes.com';

  const emailTitle = isSpanish ? 'Instrucciones para tu revisión' : 'Instructions for your review';
  const emailGreeting = isSpanish ? `Estimado/a ${assignment.reviewerName}:` : `Dear ${assignment.reviewerName}:`;

  const bodyContent = isSpanish
    ? `
      <p>Gracias por aceptar la invitación a revisar el siguiente artículo:</p>
      <div class="highlight-box">
        <p class="article-title">"${submission.title}"</p>
      </div>
      <p>Puedes acceder al manuscrito y a los materiales complementarios a través del siguiente enlace de Google Drive:</p>
      <div class="button-container">
        <a href="${submission.driveFolderUrl}" class="btn">VER MANUSCRITO EN DRIVE</a>
      </div>
      <p>Por favor, completa tu revisión antes de la fecha límite. Utiliza el siguiente enlace para enviar tu informe y recomendación:</p>
       <div class="button-container">
        <a href="${baseUrl}/reviewer-submission?assignmentId=${assignment.id}" class="btn btn-secondary">ENVIAR REVISIÓN</a>
      </div>
      <p>Recuerda que tu revisión debe ser confidencial y constructiva.</p>
    `
    : `
      <p>Thank you for accepting the invitation to review the following article:</p>
      <div class="highlight-box">
        <p class="article-title">"${submission.title}"</p>
      </div>
      <p>You can access the manuscript and supplementary materials via this Google Drive link:</p>
      <div class="button-container">
        <a href="${submission.driveFolderUrl}" class="btn">VIEW MANUSCRIPT ON DRIVE</a>
      </div>
      <p>Please complete your review by the deadline. Use the following link to submit your report and recommendation:</p>
      <div class="button-container">
        <a href="${baseUrl}/reviewer-submission?assignmentId=${assignment.id}" class="btn btn-secondary">SUBMIT REVIEW</a>
      </div>
      <p>Remember that your review must be confidential and constructive.</p>
    `;

  const htmlBody = getEmailTemplate(
    emailTitle,
    emailGreeting,
    bodyContent,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );

  await sendEmailViaExtension(assignment.reviewerEmail, emailTitle, htmlBody);
}

// Funciones para generar los cuerpos de los emails de decisión
// ============================================================================
// ============ FUNCIONES AUXILIARES PARA EMAILS (VERSIÓN CORREGIDA) =========
// ============================================================================

// --- Función CORREGIDA para Rechazo ---
function getRejectionEmailBody(feedback, articleTitle, lang, authorName) {
  const isSpanish = lang === 'es';
  const greeting = isSpanish ? `Estimado/a ${authorName}:` : `Dear ${authorName}:`;
  const title = isSpanish ? 'Decisión editorial sobre su artículo' : 'Editorial decision on your manuscript';

  const bodyContent = isSpanish
    ? `<p>Lamentamos informarle que, tras la revisión editorial, su artículo <strong>"${articleTitle}"</strong> no ha sido aceptado para su publicación en nuestra revista.</p>
       <p><strong>Feedback del editor:</strong></p>
       <div class="highlight-box">${feedback.replace(/\n/g, '<br>')}</div>
       <p>Le agradecemos por haber considerado nuestra revista para el envío de su trabajo y le animamos a enviar futuras investigaciones.</p>`
    : `<p>We regret to inform you that, following editorial review, your manuscript <strong>"${articleTitle}"</strong> has not been accepted for publication in our journal.</p>
       <p><strong>Editor's feedback:</strong></p>
       <div class="highlight-box">${feedback.replace(/\n/g, '<br>')}</div>
       <p>Thank you for considering our journal for your work and we encourage you to submit future research.</p>`;

  // Devolvemos el HTML completo usando la plantilla
  return getEmailTemplate(
    title,
    greeting,
    bodyContent,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );
}

// --- Función CORREGIDA para Solicitud de Revisión (menor o mayor)---
function getRevisionEmailBody(feedback, articleTitle, revisionType, lang, authorName) {
  const isSpanish = lang === 'es';
  const typeText = revisionType === 'minor' ? (isSpanish ? 'menor' : 'minor') : (isSpanish ? 'mayor' : 'major');
  const title = isSpanish ? 'Solicitud de revisión' : 'Revision requested';
  const greeting = isSpanish ? `Estimado/a ${authorName}:` : `Dear ${authorName}:`;

  const bodyContent = isSpanish
    ? `<p>Su artículo <strong>"${articleTitle}"</strong> ha sido evaluado y se solicita una <strong>revisión ${typeText}</strong> antes de considerar su aceptación.</p>
       <p><strong>Comentarios del editor para la revisión:</strong></p>
       <div class="highlight-box">${feedback.replace(/\n/g, '<br>')}</div>
       <p>Por favor, realice los cambios solicitados y vuelva a enviar el manuscrito revisado a través de nuestro sistema.</p>`
    : `<p>Your manuscript <strong>"${articleTitle}"</strong> has been evaluated and a <strong>${typeText} revision</strong> is requested before it can be considered for acceptance.</p>
       <p><strong>Editor's comments for revision:</strong></p>
       <div class="highlight-box">${feedback.replace(/\n/g, '<br>')}</div>
       <p>Please make the requested changes and resubmit the revised manuscript through our system.</p>`;

  return getEmailTemplate(
    title,
    greeting,
    bodyContent,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );
}

// --- Función CORREGIDA para Inicio de Revisión por Pares ---
function getPeerReviewStartEmailBody(articleTitle, lang, authorName) {
  const isSpanish = lang === 'es';
  const title = isSpanish ? 'Su artículo ha pasado a revisión por pares' : 'Your manuscript has passed to peer review';
  const greeting = isSpanish ? `Estimado/a ${authorName}:` : `Dear ${authorName}:`;

  const bodyContent = isSpanish
    ? `<p>Su artículo <strong>"${articleTitle}"</strong> ha superado la revisión editorial inicial y ha sido enviado a revisión por pares.</p>
       <p>En breve, nuestro equipo editorial seleccionará revisores externos para evaluar su trabajo. Le notificaremos cuando tengamos noticias.</p>`
    : `<p>Your manuscript <strong>"${articleTitle}"</strong> has passed the initial editorial review and has been sent for peer review.</p>
       <p>Shortly, our editorial team will select external reviewers to evaluate your work. We will notify you when we have news.</p>`;

  return getEmailTemplate(
    title,
    greeting,
    bodyContent,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );
}

// --- Función CORREGIDA para Aceptación ---
function getAcceptanceEmailBody(feedback, articleTitle, lang, authorName) {
  const isSpanish = lang === 'es';
  const title = isSpanish ? '¡Artículo aceptado!' : 'Article accepted!';
  const greeting = isSpanish ? `Estimado/a ${authorName}:` : `Dear ${authorName}:`;

  const bodyContent = isSpanish
    ? `<p>¡Nos complace informarle que su artículo <strong>"${articleTitle}"</strong> ha sido <strong>ACEPTADO</strong> para su publicación en la Revista Nacional de las Ciencias para Estudiantes!</p>
       ${feedback ? `<p><strong>Comentarios finales del editor:</strong> ${feedback}</p>` : ''}
       <p>En los próximos días recibirá las instrucciones para la firma de la cesión de derechos y los pasos finales para la publicación.</p>`
    : `<p>We are pleased to inform you that your manuscript <strong>"${articleTitle}"</strong> has been <strong>ACCEPTED</strong> for publication in The National Review of Sciences for Students!</p>
       ${feedback ? `<p><strong>Final editor's comments:</strong> ${feedback}</p>` : ''}
       <p>In the coming days you will receive instructions for signing the copyright transfer and the final steps for publication.</p>`;

  return getEmailTemplate(
    title,
    greeting,
    bodyContent,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );
}

// Función auxiliar para loguear errores en Firestore
async function logSystemError(functionName, error, context = {}) {
  try {
    await admin.firestore().collection('systemErrors').add({
      function: functionName,
      error: { message: error.message, stack: error.stack },
      context: context,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (logError) {
    console.error('Error logging to Firestore:', logError);
  }
}
// EN EL ARCHIVO index.js DE FUNCTIONS

/* ===================== SECTION EDITOR INVITATIONS ===================== */

/**
 * TRIGGER: Cuando se crea una invitación a Editor de Sección
 */
exports.onSectionEditorInvitationCreated = onDocumentCreated(
  {
    document: 'sectionEditorInvitations/{invitationId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const invitation = event.data.data();
    const invitationId = event.params.invitationId;

    console.log(`📧 [onSectionEditorInvitationCreated] Nueva invitación: ${invitationId} para ${invitation.editorEmail}`);

    try {
      const db = admin.firestore();

      // Obtener datos del que invita
      const inviterDoc = await db.collection('users').doc(invitation.invitedBy).get();
      const inviterData = inviterDoc.data() || {};
      
      const lang = invitation.language || 'es';
      const isSpanish = lang === 'es';

      // Construir enlace de respuesta
      const baseUrl = 'https://www.revistacienciasestudiantes.com';
      const responseLink = `${baseUrl}/section-editor-response?hash=${invitation.inviteHash}&lang=${lang}`;

      // Plantilla de email
      const emailTitle = isSpanish
        ? '📋 Invitación a Editor de Sección'
        : '📋 Section Editor Invitation';

      const emailGreeting = isSpanish
        ? `Estimado/a ${invitation.editorName}:`
        : `Dear ${invitation.editorName}:`;

      const areaInfo = invitation.canHandleAllAreas
        ? (isSpanish ? 'Todas las áreas de su especialidad' : 'All areas of your specialty')
        : (isSpanish ? `Área específica: ${invitation.area}` : `Specific area: ${invitation.area}`);

      const bodyContent = isSpanish
        ? `
          <p>Ha sido invitado/a a unirse al equipo editorial de la <strong>Revista Nacional de las Ciencias para Estudiantes</strong> como <strong>Editor de Sección</strong>.</p>
          
          <div class="highlight-box">
            <p><strong>Área asignada:</strong> ${areaInfo}</p>
            <p><strong>Invitado por:</strong> ${inviterData.displayName || inviterData.email || invitation.invitedByEmail}</p>
          </div>
          
          <p>Como Editor de Sección, usted tendrá autonomía para:</p>
          <ul>
            <li>Realizar la revisión editorial inicial de los artículos en su área</li>
            <li>Decidir sobre la aprobación, rechazo o envío a revisión por pares</li>
            <li>Seleccionar y gestionar revisores</li>
            <li>Tomar decisiones finales sobre los artículos de su sección</li>
          </ul>
          
          <p>Para aceptar o rechazar esta invitación, haga clic en el siguiente enlace:</p>
          
          <div class="button-container">
            <a href="${responseLink}" class="btn">RESPONDER INVITACIÓN</a>
          </div>
          
          <p><strong>Plazo para responder:</strong> 7 días.</p>
          <p class="info-text">Al aceptar, se le otorgarán los permisos necesarios en el sistema editorial.</p>
        `
        : `
          <p>You have been invited to join the editorial team of <strong>The National Review of Sciences for Students</strong> as a <strong>Section Editor</strong>.</p>
          
          <div class="highlight-box">
            <p><strong>Assigned area:</strong> ${areaInfo}</p>
            <p><strong>Invited by:</strong> ${inviterData.displayName || inviterData.email || invitation.invitedByEmail}</p>
          </div>
          
          <p>As Section Editor, you will have autonomy to:</p>
          <ul>
            <li>Perform initial editorial review of articles in your area</li>
            <li>Decide on approval, rejection, or sending to peer review</li>
            <li>Select and manage reviewers</li>
            <li>Make final decisions on articles in your section</li>
          </ul>
          
          <p>To accept or decline this invitation, please click the link below:</p>
          
          <div class="button-container">
            <a href="${responseLink}" class="btn">RESPOND TO INVITATION</a>
          </div>
          
          <p><strong>Response deadline:</strong> 7 days.</p>
          <p class="info-text">By accepting, you will be granted the necessary permissions in the editorial system.</p>
        `;

      const htmlBody = getEmailTemplate(
        emailTitle,
        emailGreeting,
        bodyContent,
        isSpanish ? 'Equipo Editorial' : 'Editorial Team',
        isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
        lang
      );

      // Enviar email
      await sendEmailViaExtension(
        invitation.editorEmail,
        isSpanish ? 'Invitación a Editor de Sección' : 'Section Editor Invitation',
        htmlBody
      );

      console.log(`✅ Email enviado a: ${invitation.editorEmail}`);

      // Actualizar que el email fue enviado
      await event.data.ref.update({
        emailSentAt: serverTimestamp()
      });

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await logSystemError('onSectionEditorInvitationCreated', error, { invitationId, ...invitation });
    }
  }
);

/**
 * TRIGGER: Cuando se responde a una invitación de Editor de Sección
 */
exports.onSectionEditorInvitationUpdated = onDocumentUpdated(
  {
    document: 'sectionEditorInvitations/{invitationId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invitationId = event.params.invitationId;

    // Solo si el estado cambió de 'pending'
    if (beforeData.status !== 'pending' || afterData.status === 'pending') {
      return;
    }

    console.log(`📝 [onSectionEditorInvitationUpdated] Invitación ${invitationId} respondida: ${afterData.status}`);

    try {
      const db = admin.firestore();

      // Si ACEPTÓ
      if (afterData.status === 'accepted') {
        // 1. Crear asignación permanente
        const assignmentData = {
          area: afterData.area,
          editorEmail: afterData.editorEmail,
          editorName: afterData.editorName,
          editorUid: afterData.editorUid || null,
          canHandleAllAreas: afterData.canHandleAllAreas || false,
          invitationId: invitationId,
          status: 'active',
          assignedAt: serverTimestamp(),
          assignedBy: afterData.invitedBy,
          // Estadísticas
          articlesHandled: 0,
          lastActivityAt: null
        };

        await addDoc(collection(db, 'sectionEditorAssignments'), assignmentData);

        // 2. Si el editor tiene cuenta, actualizar sus claims
        if (afterData.editorUid) {
          try {
            const userDoc = await db.collection('users').doc(afterData.editorUid).get();
            const userData = userDoc.data() || {};
            const currentRoles = userData.roles || [];
            
            // Añadir 'Editor de Sección' si no lo tiene
            if (!currentRoles.includes('Editor de Sección')) {
              const newRoles = [...currentRoles, 'Editor de Sección'];
              
              // Actualizar en Auth
              await admin.auth().setCustomUserClaims(afterData.editorUid, { roles: newRoles });
              
              // Actualizar en Firestore
              await db.collection('users').doc(afterData.editorUid).update({
                roles: newRoles,
                updatedAt: serverTimestamp(),
                editorialArea: afterData.area,
                editorialAssignmentId: invitationId
              });
              
              console.log(`✅ Roles actualizados para ${afterData.editorUid}`);
            }
          } catch (roleError) {
            console.error(`⚠️ Error actualizando roles:`, roleError.message);
          }
        }

        // 3. Notificar al editor jefe que invitó
        await sendSectionEditorAcceptedEmail(afterData);

      } else if (afterData.status === 'declined') {
        // Si rechazó, solo registrar
        console.log(`ℹ️ Invitación rechazada por ${afterData.editorEmail}`);
        
        // Opcional: notificar al editor jefe
        await sendSectionEditorDeclinedEmail(afterData);
      }

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      await logSystemError('onSectionEditorInvitationUpdated', error, { invitationId, ...afterData });
    }
  }
);

// Funciones auxiliares para emails
async function sendSectionEditorAcceptedEmail(invitation) {
  const db = admin.firestore();
  const inviterDoc = await db.collection('users').doc(invitation.invitedBy).get();
  const inviterData = inviterDoc.data() || {};
  
  const lang = invitation.language || 'es';
  const isSpanish = lang === 'es';

  const emailTitle = isSpanish
    ? '✅ Invitación aceptada - Editor de Sección'
    : '✅ Invitation accepted - Section Editor';

  const emailGreeting = isSpanish
    ? `Estimado/a ${inviterData.displayName || 'Editor'}:`
    : `Dear ${inviterData.displayName || 'Editor'}:`;

  const bodyContent = isSpanish
    ? `
      <p>${invitation.editorName} (${invitation.editorEmail}) ha <strong>ACEPTADO</strong> su invitación para ser Editor de Sección.</p>
      
      <div class="highlight-box">
        <p><strong>Área:</strong> ${invitation.area}</p>
        <p><strong>Fecha de aceptación:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
      </div>
      
      <p>El editor ya tiene acceso al sistema editorial y puede comenzar a gestionar artículos en su área.</p>
      
      <div class="button-container">
        <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">IR AL PORTAL</a>
      </div>
    `
    : `
      <p>${invitation.editorName} (${invitation.editorEmail}) has <strong>ACCEPTED</strong> your invitation to become a Section Editor.</p>
      
      <div class="highlight-box">
        <p><strong>Area:</strong> ${invitation.area}</p>
        <p><strong>Acceptance date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
      </div>
      
      <p>The editor now has access to the editorial system and can start managing articles in their area.</p>
      
      <div class="button-container">
        <a href="https://www.revistacienciasestudiantes.com/en/login" class="btn">GO TO PORTAL</a>
      </div>
    `;

  const htmlBody = getEmailTemplate(
    emailTitle,
    emailGreeting,
    bodyContent,
    isSpanish ? 'Sistema Editorial' : 'Editorial System',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );

  await sendEmailViaExtension(invitation.invitedByEmail, emailTitle, htmlBody);
}

async function sendSectionEditorDeclinedEmail(invitation) {
  const db = admin.firestore();
  const inviterDoc = await db.collection('users').doc(invitation.invitedBy).get();
  const inviterData = inviterDoc.data() || {};
  
  const lang = invitation.language || 'es';
  const isSpanish = lang === 'es';

  const emailTitle = isSpanish
    ? '❌ Invitación rechazada - Editor de Sección'
    : '❌ Invitation declined - Section Editor';

  const emailGreeting = isSpanish
    ? `Estimado/a ${inviterData.displayName || 'Editor'}:`
    : `Dear ${inviterData.displayName || 'Editor'}:`;

  const bodyContent = isSpanish
    ? `
      <p>${invitation.editorName} (${invitation.editorEmail}) ha <strong>RECHAZADO</strong> su invitación para ser Editor de Sección.</p>
      
      <div class="highlight-box">
        <p><strong>Área:</strong> ${invitation.area}</p>
        <p><strong>Fecha de rechazo:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
      </div>
      
      <p>Puede invitar a otro editor para esta área desde el panel editorial.</p>
    `
    : `
      <p>${invitation.editorName} (${invitation.editorEmail}) has <strong>DECLINED</strong> your invitation to become a Section Editor.</p>
      
      <div class="highlight-box">
        <p><strong>Area:</strong> ${invitation.area}</p>
        <p><strong>Decline date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
      </div>
      
      <p>You can invite another editor for this area from the editorial panel.</p>
    `;

  const htmlBody = getEmailTemplate(
    emailTitle,
    emailGreeting,
    bodyContent,
    isSpanish ? 'Sistema Editorial' : 'Editorial System',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );

  await sendEmailViaExtension(invitation.invitedByEmail, emailTitle, htmlBody);
}
/* ===================== EDITORIAL TASKS TRIGGERS ===================== */

/**
 * TRIGGER: Cuando se crea una nueva tarea editorial (asignación a Editor de Sección)
 */
exports.onEditorialTaskCreated = onDocumentCreated(
  {
    document: 'editorialTasks/{taskId}',
    secrets: [], // Los emails se manejan con la extensión
    memory: '256MiB'
  },
  async (event) => {
    const task = event.data.data();
    const taskId = event.params.taskId;

    console.log(`📋 [onEditorialTaskCreated] Nueva tarea creada: ${taskId} para editor: ${task.assignedToEmail}`);

    try {
      const db = admin.firestore();

      // Obtener datos completos del submission
      const submissionDoc = await db.collection('submissions').doc(task.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ Submission no encontrado: ${task.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();

      // Obtener datos del que asignó
      const assignerDoc = await db.collection('users').doc(task.assignedBy).get();
      const assignerData = assignerDoc.data() || {};

      const lang = submission.paperLanguage || 'es';
      const isSpanish = lang === 'es';

      // Construir email para el Editor de Sección
      const emailTitle = isSpanish
        ? '📋 Nueva tarea de revisión editorial asignada'
        : '📋 New editorial review task assigned';

      const emailGreeting = isSpanish
        ? `Estimado/a ${task.assignedToName || 'Editor'}:`
        : `Dear ${task.assignedToName || 'Editor'}:`;

      const articleInfo = `
        <div class="highlight-box">
          <p class="article-title">"${submission.title}"</p>
          <p><strong>${isSpanish ? 'ID:' : 'ID:'}</strong> ${submission.submissionId}</p>
          <p><strong>${isSpanish ? 'Área:' : 'Area:'}</strong> ${submission.area}</p>
          <p><strong>${isSpanish ? 'Autor:' : 'Author:'}</strong> ${submission.authorName}</p>
          ${task.assignmentNotes ? `<p><strong>${isSpanish ? 'Notas:' : 'Notes:'}</strong> ${task.assignmentNotes}</p>` : ''}
        </div>
      `;

      const bodyContent = isSpanish
        ? `
          <p>Se le ha asignado una nueva tarea de revisión editorial.</p>
          ${articleInfo}
          <p>Por favor, acceda al portal editorial para revisar el manuscrito y tomar una decisión.</p>
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">IR AL PORTAL</a>
            <a href="${submission.driveFolderUrl}" class="btn btn-secondary">VER EN DRIVE</a>
          </div>
          <p><strong>Plazo sugerido:</strong> 7 días para la revisión editorial.</p>
        `
        : `
          <p>A new editorial review task has been assigned to you.</p>
          ${articleInfo}
          <p>Please access the editorial portal to review the manuscript and make a decision.</p>
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/en/login" class="btn">GO TO PORTAL</a>
            <a href="${submission.driveFolderUrl}" class="btn btn-secondary">VIEW IN DRIVE</a>
          </div>
          <p><strong>Suggested deadline:</strong> 7 days for editorial review.</p>
        `;

      const htmlBody = getEmailTemplate(
        emailTitle,
        emailGreeting,
        bodyContent,
        isSpanish ? (assignerData.displayName || 'Recepción Editorial') : (assignerData.displayName || 'Editorial Reception'),
        isSpanish ? 'Encargado de Asignación' : 'Assignment Manager',
        lang
      );

      // Enviar email
      await sendEmailViaExtension(task.assignedToEmail, emailTitle, htmlBody);
      console.log(`✅ Email enviado a editor: ${task.assignedToEmail}`);

      // Actualizar tarea con timestamp de notificación
      await event.data.ref.update({
        notificationSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error(`❌ Error en onEditorialTaskCreated:`, error.message);
      await logSystemError('onEditorialTaskCreated', error, { taskId, ...task });
    }
  }
);
/* ===================== SISTEMA DE PLAZOS (DEADLINES) COMPLETO ===================== */

/**
 * 1. TRIGGER: Cuando se crea una reviewerInvitation, crear deadline para la respuesta
 */
exports.onCreateReviewerInvitationDeadline = onDocumentCreated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const invitation = event.data.data();
    const invitationId = event.params.invitationId;

    console.log(`⏰ [onCreateReviewerInvitationDeadline] Creando deadline para invitación ${invitationId}`);

    try {
      const db = admin.firestore();
      
      // Crear deadline para respuesta (7 días)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      
      const deadlineData = {
        type: 'reviewer-response',
        targetType: 'reviewerInvitation',
        targetId: invitationId,
        dueDate: dueDate,
        status: 'pending',
        reminderCount: 0,
        submissionId: invitation.submissionId,
        editorialTaskId: invitation.editorialTaskId,
        reviewerEmail: invitation.reviewerEmail,
        reviewerName: invitation.reviewerName || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('deadlines').add(deadlineData);
      console.log(`✅ Deadline creado para respuesta de invitación ${invitationId}`);

    } catch (error) {
      console.error(`❌ Error en onCreateReviewerInvitationDeadline:`, error.message);
      await logSystemError('onCreateReviewerInvitationDeadline', error, { invitationId });
    }
  }
);

/**
 * 2. TRIGGER: Cuando se acepta una reviewerInvitation, crear deadline para la revisión
 */
exports.onReviewerInvitationAcceptedDeadline = onDocumentUpdated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invitationId = event.params.invitationId;

    // Solo cuando pasa de 'pending' a 'accepted'
    if (beforeData.status !== 'pending' || afterData.status !== 'accepted') {
      return;
    }

    console.log(`⏰ [onReviewerInvitationAcceptedDeadline] Creando deadline de revisión para invitación ${invitationId}`);

    try {
      const db = admin.firestore();
      
      // Buscar si ya existe una asignación para esta invitación
      const assignmentsQuery = await db.collection('reviewerAssignments')
        .where('invitationId', '==', invitationId)
        .limit(1)
        .get();
      
      let assignmentId = 'pending';
      if (!assignmentsQuery.empty) {
        assignmentId = assignmentsQuery.docs[0].id;
      }
      
      // Crear deadline para enviar la revisión (21 días)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 21);
      
      const deadlineData = {
        type: 'review-submission',
        targetType: 'reviewerAssignment',
        targetId: assignmentId, // Se actualizará después si es 'pending'
        dueDate: dueDate,
        status: 'pending',
        reminderCount: 0,
        submissionId: afterData.submissionId,
        editorialTaskId: afterData.editorialTaskId,
        reviewerEmail: afterData.reviewerEmail,
        reviewerName: afterData.reviewerName || '',
        invitationId: invitationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('deadlines').add(deadlineData);
      console.log(`✅ Deadline de revisión creado para invitación ${invitationId}`);

    } catch (error) {
      console.error(`❌ Error en onReviewerInvitationAcceptedDeadline:`, error.message);
      await logSystemError('onReviewerInvitationAcceptedDeadline', error, { invitationId });
    }
  }
);

/**
 * 3. TRIGGER: Cuando se crea una reviewerAssignment, actualizar el deadline pendiente
 */
exports.onReviewerAssignmentCreatedDeadline = onDocumentCreated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const assignment = event.data.data();
    const assignmentId = event.params.assignmentId;

    console.log(`⏰ [onReviewerAssignmentCreatedDeadline] Actualizando deadline para assignment ${assignmentId}`);

    try {
      const db = admin.firestore();
      
      // Buscar deadline con targetId='pending' y la invitationId correcta
      const deadlinesQuery = await db.collection('deadlines')
        .where('invitationId', '==', assignment.invitationId)
        .where('targetId', '==', 'pending')
        .where('type', '==', 'review-submission')
        .limit(1)
        .get();
      
      if (!deadlinesQuery.empty) {
        await deadlinesQuery.docs[0].ref.update({
          targetId: assignmentId
        });
        console.log(`✅ Deadline de envío actualizado con assignmentId ${assignmentId}`);
      }

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentCreatedDeadline:`, error.message);
      await logSystemError('onReviewerAssignmentCreatedDeadline', error, { assignmentId });
    }
  }
);

/**
 * 4. FUNCIÓN PROGRAMADA: Verificar deadlines cada hora y enviar recordatorios
 */
exports.checkDeadlines = onSchedule('every 1 hours', async (event) => {
  console.log('⏰ [checkDeadlines] Ejecutando verificación de deadlines...');
  
  const db = admin.firestore();
  const now = new Date();
  
  try {
    // 1. Buscar deadlines que vencen en las próximas 24 horas (para recordatorios)
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const soonDeadlines = await db.collection('deadlines')
      .where('status', '==', 'pending')
      .where('dueDate', '<=', soon)
      .where('dueDate', '>', now)
      .get();
    
    console.log(`⏰ Encontrados ${soonDeadlines.size} deadlines próximos a vencer`);
    
    for (const doc of soonDeadlines.docs) {
      const deadline = doc.data();
      
      // Enviar recordatorio si es el primero
      if (deadline.reminderCount === 0) {
        await sendDeadlineReminder(deadline);
        await doc.ref.update({
          reminderCount: 1,
          remindedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'reminded'
        });
      }
    }
    
    // 2. Buscar deadlines vencidos
    const expiredDeadlines = await db.collection('deadlines')
      .where('status', 'in', ['pending', 'reminded'])
      .where('dueDate', '<', now)
      .get();
    
    console.log(`⏰ Encontrados ${expiredDeadlines.size} deadlines vencidos`);
    
    for (const doc of expiredDeadlines.docs) {
      const deadline = doc.data();
      await handleExpiredDeadline(deadline);
      await doc.ref.update({ 
        status: 'missed',
        missedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log('✅ [checkDeadlines] Verificación completada');
    
  } catch (error) {
    console.error('❌ Error en checkDeadlines:', error.message);
    await logSystemError('checkDeadlines', error);
  }
});

/**
 * 5. FUNCIÓN AUXILIAR: Enviar recordatorio por email
 */
async function sendDeadlineReminder(deadline) {
  const { type, reviewerEmail, reviewerName, dueDate } = deadline;
  
  try {
    const isSpanish = true; // Idealmente, detectar idioma del revisor
    const formattedDate = dueDate.toDate().toLocaleDateString(isSpanish ? 'es-CL' : 'en-US');
    
    let subject, bodyContent;
    
    if (type === 'reviewer-response') {
      subject = isSpanish ? '⏰ Recordatorio: Responder invitación de revisión' : '⏰ Reminder: Respond to review invitation';
      bodyContent = isSpanish
        ? `<p>Estimado/a ${reviewerName || 'colega'}:</p>
           <p>Le recordamos que tiene una invitación de revisión pendiente.</p>
           <p><strong>Fecha límite para responder:</strong> ${formattedDate}</p>
           <p>Por favor, acceda al enlace en su correo de invitación para aceptar o rechazar.</p>`
        : `<p>Dear ${reviewerName || 'colleague'}:</p>
           <p>This is a reminder that you have a pending review invitation.</p>
           <p><strong>Response deadline:</strong> ${formattedDate}</p>
           <p>Please use the link in your invitation email to accept or decline.</p>`;
    } else if (type === 'review-submission') {
      subject = isSpanish ? '⏰ Recordatorio: Enviar su revisión' : '⏰ Reminder: Submit your review';
      bodyContent = isSpanish
        ? `<p>Estimado/a ${reviewerName || 'revisor'}:</p>
           <p>Le recordamos que debe enviar su revisión antes del <strong>${formattedDate}</strong>.</p>
           <p>Puede acceder a su espacio de trabajo en el portal editorial.</p>`
        : `<p>Dear ${reviewerName || 'reviewer'}:</p>
           <p>This is a reminder that your review is due by <strong>${formattedDate}</strong>.</p>
           <p>You can access your workspace in the editorial portal.</p>`;
    } else {
      return;
    }
    
    const htmlBody = getEmailTemplate(
      subject,
      '',
      bodyContent,
      'Sistema Editorial',
      'Revista Nacional de las Ciencias para Estudiantes',
      isSpanish ? 'es' : 'en'
    );
    
    await sendEmailViaExtension(reviewerEmail, subject, htmlBody);
    console.log(`✅ Recordatorio enviado a ${reviewerEmail}`);
    
  } catch (error) {
    console.error(`❌ Error enviando recordatorio:`, error.message);
  }
}

/**
 * 6. FUNCIÓN AUXILIAR: Manejar deadline vencido
 */
async function handleExpiredDeadline(deadline) {
  const { type, targetType, targetId, reviewerEmail, reviewerName } = deadline;
  const db = admin.firestore();
  
  try {
    if (type === 'reviewer-response' && targetType === 'reviewerInvitation') {
      // La invitación expiró, marcarla como expirada
      await db.collection('reviewerInvitations').doc(targetId).update({
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Notificar al editor (implementar si es necesario)
      console.log(`⚠️ Invitación ${targetId} expirada para ${reviewerEmail}`);
      
    } else if (type === 'review-submission' && targetType === 'reviewerAssignment') {
      // La asignación expiró, marcarla como overdue
      if (targetId && targetId !== 'pending') {
        await db.collection('reviewerAssignments').doc(targetId).update({
          status: 'overdue',
          overdueAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      console.log(`⚠️ Asignación ${targetId} vencida para ${reviewerEmail}`);
    }
    
  } catch (error) {
    console.error(`❌ Error manejando deadline vencido:`, error.message);
  }
}

/* ===================== CORRECCIÓN DE onEditorialReviewUpdated ===================== */

/**
 * VERSIÓN CORREGIDA de onEditorialReviewUpdated
 * Reemplaza la función existente con esta versión
 */
exports.onEditorialReviewUpdated = onDocumentUpdated(
  {
    document: 'editorialReviews/{reviewId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const reviewId = event.params.reviewId;

    // Solo proceder si la decisión ha cambiado y ahora NO es null
    if (beforeData.decision === afterData.decision || afterData.decision === null) {
      return;
    }

    console.log(`📝 [onEditorialReviewUpdated] Decisión tomada para revisión ${reviewId}: ${afterData.decision}`);

    try {
      const db = admin.firestore();
      const submissionRef = db.collection('submissions').doc(afterData.submissionId);
      const submissionSnap = await submissionRef.get();

      if (!submissionSnap.exists) {
        console.error(`❌ Envío no encontrado: ${afterData.submissionId}`);
        return;
      }

      const submissionData = submissionSnap.data();
      
      let newSubmissionStatus = 'submitted';
      let newTaskStatus = '';
      let emailHtml = '';
      const lang = submissionData.paperLanguage || 'es';
      const authorName = submissionData.authorName || 'Autor';

      switch (afterData.decision) {
        case 'reject':
          newSubmissionStatus = 'rejected';
          newTaskStatus = 'completed';
          emailHtml = getRejectionEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName);
          break;
          
        case 'minor-revision':
          // Esto no debería ocurrir en desk review, pero lo manejamos
          newSubmissionStatus = 'minor-revision-required';
          newTaskStatus = 'completed';
          emailHtml = getRevisionEmailBody(afterData.feedbackToAuthor, submissionData.title, 'minor', lang, authorName);
          break;
          
        case 'revision-required':
          newSubmissionStatus = 'in-reviewer-selection';
          newTaskStatus = 'reviewer-selection'; // ¡NO completada!
          emailHtml = getPeerReviewStartEmailBody(submissionData.title, lang, authorName);
          break;
          
        case 'accept':
          newSubmissionStatus = 'accepted';
          newTaskStatus = 'completed';
          emailHtml = getAcceptanceEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName);
          break;
          
        default:
          console.warn(`⚠️ Decisión desconocida: ${afterData.decision}`);
          return;
      }

      // Actualizar el submission
      await submissionRef.update({
        status: newSubmissionStatus,
        deskReviewDecision: afterData.decision,
        deskReviewFeedback: afterData.feedbackToAuthor,
        deskReviewCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Actualizar la tarea editorial si existe
      if (afterData.editorialTaskId) {
        const taskRef = db.collection('editorialTasks').doc(afterData.editorialTaskId);
        
        const updateData = {
          deskReviewDecision: afterData.decision,
          deskReviewFeedback: afterData.feedbackToAuthor,
          deskReviewComments: afterData.commentsToEditorial || '',
          deskReviewCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // Solo cambiar el estado si es 'revision-required'
        if (newTaskStatus) {
          updateData.status = newTaskStatus;
        }
        
        await taskRef.update(updateData);
        console.log(`✅ Tarea editorial ${afterData.editorialTaskId} actualizada a estado: ${newTaskStatus || 'sin cambio'}`);
      }

      // Enviar email al autor
      if (emailHtml && submissionData.authorEmail) {
        const emailSubject = lang === 'es' ? 'Actualización sobre su envío' : 'Update on your submission';
        await sendEmailViaExtension(submissionData.authorEmail, emailSubject, emailHtml);
        console.log(`✅ Email enviado a autor: ${submissionData.authorEmail}`);
      }

      console.log(`✅ Envío ${afterData.submissionId} actualizado a estado: ${newSubmissionStatus}`);

    } catch (error) {
      console.error(`❌ [onEditorialReviewUpdated] Error:`, error.message);
      await logSystemError('onEditorialReviewUpdated', error, { reviewId, ...afterData });
    }
  }
);

/* ===================== NUEVO: EMAIL PARA REVIEWER ASSIGNMENT ===================== */

/**
 * 7. TRIGGER: Cuando se crea una reviewerAssignment (después de aceptar invitación)
 * Enviar email con instrucciones al revisor
 */
exports.onReviewerAssignmentCreatedEmail = onDocumentCreated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const assignment = event.data.data();
    const assignmentId = event.params.assignmentId;

    console.log(`📧 [onReviewerAssignmentCreatedEmail] Enviando instrucciones para asignación ${assignmentId}`);

    try {
      const db = admin.firestore();
      
      // Obtener datos del submission
      const submissionDoc = await db.collection('submissions').doc(assignment.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ Submission no encontrado: ${assignment.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();
      
      const lang = submission.paperLanguage || 'es';
      const isSpanish = lang === 'es';
      const baseUrl = 'https://www.revistacienciasestudiantes.com';
      
      const emailTitle = isSpanish ? 'Instrucciones para tu revisión' : 'Instructions for your review';
      const emailGreeting = isSpanish 
        ? `Estimado/a ${assignment.reviewerName}:` 
        : `Dear ${assignment.reviewerName}:`;
      
      // Calcular fecha límite (debería estar en assignment.dueDate)
      const dueDate = assignment.dueDate?.toDate() || new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      const formattedDate = dueDate.toLocaleDateString(isSpanish ? 'es-CL' : 'en-US');
      
      const bodyContent = isSpanish
        ? `
          <p>Gracias por aceptar la invitación a revisar el siguiente artículo:</p>
          
          <div class="highlight-box">
            <p class="article-title">"${submission.title}"</p>
            <p><strong>Área:</strong> ${submission.area}</p>
            <p><strong>ID:</strong> ${submission.submissionId}</p>
          </div>
          
          <p><strong>Instrucciones:</strong></p>
          <ol>
            <li>Acceda al manuscrito completo en Google Drive usando el enlace abajo.</li>
            <li>Utilice el espacio de trabajo en el portal para completar su evaluación.</li>
            <li>Evalúe según los criterios establecidos (relevancia, metodología, claridad, originalidad).</li>
            <li>Proporcione comentarios constructivos para el autor.</li>
            <li>Incluya comentarios confidenciales para el editor si es necesario.</li>
            <li>Seleccione su recomendación final.</li>
          </ol>
          
          <div class="button-container">
            <a href="${submission.driveFolderUrl}" class="btn">VER MANUSCRITO EN DRIVE</a>
            <a href="${baseUrl}/reviewer-workspace/${assignmentId}" class="btn btn-secondary">IR AL ESPACIO DE TRABAJO</a>
          </div>
          
          <p><strong>Fecha límite para enviar su revisión:</strong> ${formattedDate}</p>
          
          <p class="info-text">
            <strong>Importante:</strong> Su revisión será confidencial. No comparta el manuscrito ni sus comentarios con terceros.
          </p>
        `
        : `
          <p>Thank you for accepting the invitation to review the following article:</p>
          
          <div class="highlight-box">
            <p class="article-title">"${submission.title}"</p>
            <p><strong>Area:</strong> ${submission.area}</p>
            <p><strong>ID:</strong> ${submission.submissionId}</p>
          </div>
          
          <p><strong>Instructions:</strong></p>
          <ol>
            <li>Access the full manuscript on Google Drive using the link below.</li>
            <li>Use the workspace in the portal to complete your evaluation.</li>
            <li>Evaluate according to established criteria (relevance, methodology, clarity, originality).</li>
            <li>Provide constructive comments for the author.</li>
            <li>Include confidential comments for the editor if necessary.</li>
            <li>Select your final recommendation.</li>
          </ol>
          
          <div class="button-container">
            <a href="${submission.driveFolderUrl}" class="btn">VIEW MANUSCRIPT ON DRIVE</a>
            <a href="${baseUrl}/reviewer-workspace/${assignmentId}" class="btn btn-secondary">GO TO WORKSPACE</a>
          </div>
          
          <p><strong>Deadline to submit your review:</strong> ${formattedDate}</p>
          
          <p class="info-text">
            <strong>Important:</strong> Your review is confidential. Do not share the manuscript or your comments with third parties.
          </p>
        `;
      
      const htmlBody = getEmailTemplate(
        emailTitle,
        emailGreeting,
        bodyContent,
        isSpanish ? 'Equipo Editorial' : 'Editorial Team',
        isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
        lang
      );
      
      await sendEmailViaExtension(assignment.reviewerEmail, emailTitle, htmlBody);
      console.log(`✅ Email de instrucciones enviado a ${assignment.reviewerEmail}`);
      
    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentCreatedEmail:`, error.message);
      await logSystemError('onReviewerAssignmentCreatedEmail', error, { assignmentId });
    }
  }
);

/* ===================== NUEVO: NOTIFICACIÓN CUANDO SE ALCANZA EL MÍNIMO DE REVISIONES ===================== */

/**
 * 8. TRIGGER: Cuando una editorialTask cambia a 'awaiting-decision'
 * Notificar al editor que ya puede tomar la decisión final
 */
exports.onEditorialTaskAwaitingDecision = onDocumentUpdated(
  {
    document: 'editorialTasks/{taskId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const taskId = event.params.taskId;

    // Solo cuando pasa a 'awaiting-decision'
    if (beforeData.status === afterData.status || afterData.status !== 'awaiting-decision') {
      return;
    }

    console.log(`📧 [onEditorialTaskAwaitingDecision] Tarea ${taskId} lista para decisión final`);

    try {
      const db = admin.firestore();
      
      // Obtener datos completos
      const submissionDoc = await db.collection('submissions').doc(afterData.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ Submission no encontrado: ${afterData.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();
      
      // Obtener todas las revisiones
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .where('status', '==', 'submitted')
        .get();
      
      const lang = submission.paperLanguage || 'es';
      const isSpanish = lang === 'es';
      
      const emailTitle = isSpanish 
        ? '📋 Revisiones completadas - Decisión pendiente' 
        : '📋 Reviews completed - Decision pending';
      
      const emailGreeting = isSpanish
        ? `Estimado/a ${afterData.assignedToName || 'Editor'}:`
        : `Dear ${afterData.assignedToName || 'Editor'}:`;
      
      // Listar revisiones recibidas
      let reviewsList = '';
      assignmentsSnapshot.forEach(doc => {
        const review = doc.data();
        reviewsList += isSpanish
          ? `<li><strong>${review.reviewerName}</strong>: Recomendación: ${review.recommendation || 'No especificada'}</li>`
          : `<li><strong>${review.reviewerName}</strong>: Recommendation: ${review.recommendation || 'Not specified'}</li>`;
      });
      
      const bodyContent = isSpanish
        ? `
          <p>El artículo <strong>"${submission.title}"</strong> ha recibido el mínimo de revisiones requeridas.</p>
          
          <div class="highlight-box">
            <p><strong>Revisiones recibidas (${assignmentsSnapshot.size}):</strong></p>
            <ul>${reviewsList}</ul>
          </div>
          
          <p>Por favor, revise los informes de los revisores y tome la decisión final sobre el artículo.</p>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">IR AL PORTAL</a>
          </div>
        `
        : `
          <p>The article <strong>"${submission.title}"</strong> has received the minimum required reviews.</p>
          
          <div class="highlight-box">
            <p><strong>Reviews received (${assignmentsSnapshot.size}):</strong></p>
            <ul>${reviewsList}</ul>
          </div>
          
          <p>Please review the referee reports and make the final decision on the article.</p>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/en/login" class="btn">GO TO PORTAL</a>
          </div>
        `;
      
      const htmlBody = getEmailTemplate(
        emailTitle,
        emailGreeting,
        bodyContent,
        isSpanish ? 'Sistema Editorial' : 'Editorial System',
        isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
        lang
      );
      
      await sendEmailViaExtension(afterData.assignedToEmail, emailTitle, htmlBody);
      console.log(`✅ Notificación enviada a editor ${afterData.assignedToEmail}`);
      
    } catch (error) {
      console.error(`❌ Error en onEditorialTaskAwaitingDecision:`, error.message);
      await logSystemError('onEditorialTaskAwaitingDecision', error, { taskId });
    }
  }
);

/* ===================== NUEVO: MANEJO DE RONDAS MÚLTIPLES ===================== */

/**
 * 9. FUNCIÓN: Crear una nueva ronda de revisión
 * (Puede ser llamada desde una Cloud Function o desde el frontend)
 */
exports.createNewReviewRound = onCall(
  {
    secrets: [],
    memory: '256MiB'
  },
  async (request) => {
    const { HttpsError } = require("firebase-functions/v2/https");
    
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
      }
      
      const { submissionId, roundNumber, revisionNotes } = request.data;
      
      if (!submissionId || !roundNumber) {
        throw new HttpsError('invalid-argument', 'Faltan datos requeridos');
      }
      
      const db = admin.firestore();
      const uid = request.auth.uid;
      
      // Verificar permisos
      const userDoc = await db.collection('users').doc(uid).get();
      const userRoles = userDoc.data()?.roles || [];
      const isEditor = userRoles.includes('Director General') || 
                       userRoles.includes('Editor en Jefe') || 
                       userRoles.includes('Editor de Sección');
      
      if (!isEditor) {
        throw new HttpsError('permission-denied', 'No tienes permiso para crear nuevas rondas');
      }
      
      // Obtener el submission
      const submissionRef = db.collection('submissions').doc(submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        throw new HttpsError('not-found', 'Submission no encontrado');
      }
      
      const submission = submissionSnap.data();
      
      // Actualizar submission para nueva ronda
      await submissionRef.update({
        currentRound: roundNumber,
        status: 'in-reviewer-selection',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Crear una nueva editorialTask para esta ronda
      // (Aquí deberías determinar a qué editor asignarla)
      const editorsSnapshot = await db.collection('users')
        .where('roles', 'array-contains', 'Editor de Sección')
        .where('editorialArea', '==', submission.area)
        .limit(1)
        .get();
      
      let assignedTo = null;
      let assignedToEmail = null;
      let assignedToName = null;
      
      if (!editorsSnapshot.empty) {
        const editor = editorsSnapshot.docs[0].data();
        assignedTo = editorsSnapshot.docs[0].id;
        assignedToEmail = editor.email;
        assignedToName = editor.displayName || `${editor.firstName || ''} ${editor.lastName || ''}`.trim();
      }
      
      // Si no hay editor de sección, asignar al Editor en Jefe
      if (!assignedTo) {
        const chiefSnapshot = await db.collection('users')
          .where('roles', 'array-contains', 'Editor en Jefe')
          .limit(1)
          .get();
        
        if (!chiefSnapshot.empty) {
          const chief = chiefSnapshot.docs[0].data();
          assignedTo = chiefSnapshot.docs[0].id;
          assignedToEmail = chief.email;
          assignedToName = chief.displayName || `${chief.firstName || ''} ${chief.lastName || ''}`.trim();
        } else {
          // Fallback
          assignedTo = uid;
          assignedToEmail = request.auth.token.email || '';
          assignedToName = 'Editor';
        }
      }
      
      const taskData = {
        submissionId: submissionId,
        round: roundNumber,
        assignedTo: assignedTo,
        assignedToEmail: assignedToEmail,
        assignedToName: assignedToName,
        assignedBy: uid,
        status: 'pending',
        revisionNotes: revisionNotes || '',
        requiredReviewers: 2,
        reviewsSubmitted: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const taskRef = await db.collection('editorialTasks').add(taskData);
      
      // Registrar en audit log
      await db.collection('submissions').doc(submissionId)
        .collection('auditLogs').add({
          action: 'new_round_created',
          round: roundNumber,
          by: uid,
          byEmail: request.auth.token.email || '',
          taskId: taskRef.id,
          notes: revisionNotes,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      
      return {
        success: true,
        taskId: taskRef.id,
        round: roundNumber,
        message: `Nueva ronda ${roundNumber} creada exitosamente`
      };
      
    } catch (error) {
      console.error('❌ Error en createNewReviewRound:', error);
      
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);