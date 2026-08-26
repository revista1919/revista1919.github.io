"use strict";

/* ===================== IMPORTS ===================== */
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2"); // ← QUITAMOS onInit temporalmente
const { onSchedule } = require("firebase-functions/v2/scheduler");
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
  minInstances: 0,        // ← CERO instancias en idle
  timeoutSeconds: 540,    // ← 9 minutos (máximo permitido)
  memory: "512MiB"
});
const { Readable } = require('stream'); 
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
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
let docxLib = null; // ← NUEVO
let jszipLib = null;
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
           import('https').then(m => m.default).catch(e => { console.error('Error cargando https:', e.message); return null; }),
            import('docx').then(m => m).catch(e => { console.error('Error cargando docx:', e.message); return null; }),
      import('jszip').then(m => m.default || m).catch(e => { console.error('Error cargando jszip:', e.message); return null; })
    ]);
  
    
    GoogleGenAI = modules[0].status === 'fulfilled' ? modules[0].value : null;
    Octokit = modules[1].status === 'fulfilled' ? modules[1].value : null;
    FormData = modules[2].status === 'fulfilled' ? modules[2].value : null;
    fetch = modules[3].status === 'fulfilled' ? modules[3].value : null;
    google = modules[4].status === 'fulfilled' ? modules[4].value : null;
    http = modules[5].status === 'fulfilled' ? modules[5].value : null;
    https = modules[6].status === 'fulfilled' ? modules[6].value : null;
        docxLib = modules[7].status === 'fulfilled' ? modules[7].value : null;
    jszipLib = modules[8].status === 'fulfilled' ? modules[8].value : null; // ← NUEVO
      console.log("📦 Estado de dependencias:", {
      GoogleGenAI: !!GoogleGenAI,
      Octokit: !!Octokit,
      FormData: !!FormData,
      fetch: !!fetch,
      google: !!google,
      http: !!http,
      https: !!https,
      docx: !!docxLib, // ← NUEVO
      jszip: !!jszipLib 
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
const DEEPSEEK_API_KEY = defineSecret("OPENROUTER_API_KEY"); // NUEVO: Secret para DeepSeek
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

const NEWS_URL = 'https://www.revistacienciasestudiantes.com/news/news.json';
const CUTOFF_DATE = new Date('2026-08-25T00:00:00Z').getTime();
const EMAIL_QUEUE_COLLECTION = 'mail';
const NEWSLETTER_COLLECTION = 'newsletter';
const UNSUBSCRIBE_COLLECTION = 'unsubscribes';
const NEWSLETTER_HISTORY = 'newsletter_history';

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
let cachedLagunaFetch = null;
// Forzar disponibilidad de fetch lo antes posible
globalThis.fetch = globalThis.fetch || null;
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
/**
 * Sanitiza texto para prevenir inyecciones
 */
function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[<>]/g, '') // Eliminar HTML tags
    .replace(/javascript:/gi, '') // Prevenir XSS
    .trim();
}

/**
 * Verifica si es un documento válido
 */
function isValidDocument(base64Sample) {
  const decoded = Buffer.from(base64Sample, 'base64').toString('hex');
  // Firmas mágicas de documentos Word
  const docxSignature = '504b0304'; // PK..
  const docSignature = 'd0cf11e0a1b11ae1'; // OLE2
  return decoded.startsWith(docxSignature) || decoded.startsWith(docSignature);
}
function base64DecodeUnicode(str) {
  try { return str ? Buffer.from(str, "base64").toString("utf-8") : ""; } catch { return ""; }
}
// Función para validar archivos de consentimiento (PDF, DOC, DOCX)
function isValidConsentFile(base64Header, fileName) {
  try {
    if (!base64Header || base64Header.length < 30) return false;
    
    // Obtener extensión del archivo
    const ext = fileName?.toLowerCase().split('.').pop();
    
    // Validar PDF por extensión y firma
    if (ext === 'pdf') {
      const buffer = Buffer.from(base64Header.substring(0, 10), 'base64');
      const header = buffer.toString('ascii');
      return header.startsWith('%PDF');
    }
    
    // Validar DOCX por extensión y firma
    if (ext === 'docx') {
      const buffer = Buffer.from(base64Header.substring(0, 30), 'base64');
      const header = buffer.toString('hex').substring(0, 8);
      return header.startsWith('504b0304'); // Firma ZIP (DOCX)
    }
    
    // Validar DOC por extensión y firma
    if (ext === 'doc') {
      const buffer = Buffer.from(base64Header.substring(0, 30), 'base64');
      const header = buffer.toString('hex').substring(0, 8);
      return header.startsWith('d0cf11e0'); // Firma OLE (DOC)
    }
    
    // Si no hay extensión válida, intentar detectar por firma
    const buffer = Buffer.from(base64Header.substring(0, 30), 'base64');
    const header = buffer.toString('hex').substring(0, 8);
    
    return header.startsWith('504b0304') || 
           header.startsWith('d0cf11e0') || 
           Buffer.from(base64Header.substring(0, 10), 'base64')
                 .toString('ascii')
                 .startsWith('%PDF');
    
  } catch {
    return false;
  }
}

// Función para obtener la extensión correcta del archivo de consentimiento
function getConsentFileExtension(fileName, base64Header) {
  // Primero intentar con la extensión del nombre
  const ext = fileName?.toLowerCase().split('.').pop();
  if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
    return `.${ext}`;
  }
  
  // Si no hay extensión válida, detectar por firma
  try {
    const buffer = Buffer.from(base64Header.substring(0, 30), 'base64');
    const header = buffer.toString('hex').substring(0, 8);
    
    if (header.startsWith('504b0304')) return '.docx';
    if (header.startsWith('d0cf11e0')) return '.doc';
    
    const asciiHeader = Buffer.from(base64Header.substring(0, 10), 'base64').toString('ascii');
    if (asciiHeader.startsWith('%PDF')) return '.pdf';
  } catch {
    // Si falla la detección, usar PDF como predeterminado
    return '.pdf';
  }
  
  return '.pdf';
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

/* ===================== LAGUNA (PRINCIPAL) ===================== */
async function getLagunaFetch() {
  if (!fetch) throw new Error("fetch no está disponible");
  
  if (!cachedLagunaFetch) {
    const apiKey = DEEPSEEK_API_KEY.value(); // Usamos la misma API key
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY no configurada");
    
    // Configurar fetch con los agentes HTTP/HTTPS
    cachedLagunaFetch = async (url, options = {}) => {
      const fetchOptions = {
        ...options,
        agent: url.startsWith('https') ? httpsAgent : httpAgent
      };
      return fetch(url, fetchOptions);
    };
  }
  return cachedLagunaFetch;
}

async function callLaguna(prompt, temperature = 0) {
  console.log("🤖 Intentando con Laguna (modelo: poolside/laguna-xs-2.1:free)");
  
  try {
    const lagunaFetch = await getLagunaFetch();
    const apiKey = DEEPSEEK_API_KEY.value();
    
    const response = await lagunaFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.revistacienciasestudiantes.com",
        "X-Title": "Revista Nacional de Ciencias para Estudiantes"
      },
      body: JSON.stringify({
        model: "poolside/laguna-xs-2.1:free",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: 16384
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Laguna API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    let text = data.choices[0]?.message?.content?.trim() || "";
    
    // Limpiar marcadores de código si existen
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    
    console.log("✅ Laguna respondió exitosamente");
    return text;
    
  } catch (error) {
    console.error("❌ Error con Laguna:", error.message);
    throw error; // Re-lanzamos para que el fallback lo capture
  }
}

/* ===================== GEMINI (FALLBACK) ===================== */
async function getGenAI() {
  if (!GoogleGenAI) throw new Error("GoogleGenAI no está disponible");
  if (!cachedGenAI) {
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
    cachedGenAI = new GoogleGenAI({ apiKey });
  }
  return cachedGenAI;
}

// Esta función ahora actúa como FALLBACK (mantenemos el nombre original para compatibilidad)
async function callGemini(prompt, temperature = 0) {
  console.log("⚠️ Usando Gemini como fallback");
  
  try {
    const ai = await getGenAI();

    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
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
    
    console.log("✅ Gemini fallback respondió exitosamente");
    return text;
    
  } catch (error) {
    console.error("❌ Error incluso con Gemini fallback:", error.message);
    throw new Error("Todos los servicios de IA fallaron");
  }
}

/* ===================== FUNCIÓN PRINCIPAL DE IA CON FALLBACK ===================== */
async function callAIWithFallback(prompt, temperature = 0) {
  console.log("🚀 Iniciando llamada a IA con fallback");
  
  // Intentar primero con Laguna
  try {
    const result = await callLaguna(prompt, temperature);
    console.log("✅ Traducción completada con Laguna");
    return result;
  } catch (lagunaError) {
    console.log("🔄 Laguna falló, intentando con Gemini...", lagunaError.message);
    
    // Si Laguna falla, intentar con Gemini
    try {
      const result = await callGemini(prompt, temperature);
      console.log("✅ Traducción completada con Gemini fallback");
      return result;
    } catch (geminiError) {
      console.error("💥 Ambos servicios de IA fallaron");
      throw new Error("No se pudo completar la operación con ningún servicio de IA");
    }
  }
}
/* ===================== FUNCIÓN DE TRADUCCIÓN (ACTUALIZADA CON FALLBACK) ===================== */
async function translateText(text, source, target) {
  const prompt = `You are a faithful translator for an academic journal. The National Review of Sciences for Students in English, and Revista Nacional de las Ciencias in Spanish.

Task:
Translate the following text from ${source} to ${target}.

Rules:
- Translate faithfully and accurately.
- Do not add, remove, or reinterpret meaning.
- Output ONLY the translated text.

Text to translate:
"${text}"`;

  // Usamos la función con fallback
  return await callAIWithFallback(prompt);
}

async function translateHtmlFragment(html, source, target) {
  const prompt = `
You are a faithful translator for an academic journal, The National Review of Sciences for Students en inglés, y Revista Nacional de las Ciencias en español.

Task:
Translate all translatable texts in the following HTML code fragment to ${target}.
The original language is ${source}.

Rules:
- Preserve ALL HTML structure exactly
- Only translate user-facing text nodes. Links of articles of the journal must include an "EN" before ".html" if the target lenguage is english, and include nothing if it is spanish.
- Output ONLY the translated HTML fragment

HTML code fragment to translate:
${html}`;

  // Usamos la función con fallback
  return await callAIWithFallback(prompt);
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

// manageImages.js - Añadir a tus Cloud Functions

/* ===================== MANAGE IMAGES ===================== */
exports.manageImages = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB" // Más memoria para procesar imágenes
  },
  async (req, res) => {
    const origin = req.headers.origin;
    const ALLOWED_ORIGINS = [
      'https://www.revistacienciasestudiantes.com',
      'https://revistacienciasestudiantes.com',
      'http://localhost:3000',
      'http://localhost:5000'
    ];

    // CORS handling
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    } else {
      res.set('Access-Control-Allow-Origin', 'https://www.revistacienciasestudiantes.com');
    }
    
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept');
    res.set('Access-Control-Max-Age', '3600');
    res.set('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] 🖼️ manageImages - Iniciando petición`);

    try {
      // Verificar dependencias
      if (!Octokit || !fetch) {
        await loadDependencies();
        if (!Octokit || !fetch) {
          return res.status(500).json({ error: "Servicios no disponibles" });
        }
      }

      // Autenticación
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No autorizado - Token requerido" });
      }

      const token = authHeader.split("Bearer ")[1];
      let user;
      try {
        user = await admin.auth().verifyIdToken(token);
        console.log(`[${requestId}] ✅ Usuario autenticado: ${user.email || user.uid}`);
      } catch (authError) {
        return res.status(401).json({ error: "Token inválido" });
      }

      // Validar rol (solo Directores pueden subir imágenes)
      try {
        await validateRole(user.uid, "Director General");
        console.log(`[${requestId}] ✅ Rol verificado: Director General`);
      } catch (roleError) {
        return res.status(403).json({ error: "Se requiere rol de Director General" });
      }

      const { action, imageBase64, imageId, fileName } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: "Acción requerida (list/upload/replace/delete)" });
      }

      console.log(`[${requestId}] 📋 Acción: ${action}`);

      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "images";
      const BRANCH = "main";
      const BASE_URL = `https://${REPO_OWNER}.github.io/${REPO_NAME}`;

      // ===== LISTAR IMÁGENES =====
      if (action === "list") {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: "",
            ref: BRANCH
          });

          // Filtrar solo imágenes (webp, jpg, png, gif)
          const images = data
            .filter(item => {
              const ext = item.name.split('.').pop().toLowerCase();
              return item.type === 'file' && ['webp', 'jpg', 'jpeg', 'png', 'gif'].includes(ext);
            })
            .map(item => ({
              id: item.name.replace(/\.[^/.]+$/, ""), // nombre sin extensión
              name: item.name,
              url: `${BASE_URL}/${item.name}`,
              size: item.size,
              sha: item.sha,
              uploadedAt: new Date().toISOString(), // GitHub no da fecha, usamos actual
              extension: item.name.split('.').pop().toLowerCase()
            }))
            .sort((a, b) => b.name.localeCompare(a.name)); // Más recientes primero

          return res.json({
            success: true,
            images: images,
            total: images.length
          });
        } catch (error) {
          if (error.status === 404) {
            return res.json({ success: true, images: [], total: 0 });
          }
          throw error;
        }
      }

      // ===== SUBIR/REEMPLAZAR IMAGEN =====
      if (action === "upload" || action === "replace") {
        if (!imageBase64) {
          return res.status(400).json({ error: "Falta imageBase64" });
        }

        // Procesar la imagen
        try {
          // 1. Generar ID único
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8);
          const imageId = action === "replace" && req.body.imageId 
            ? req.body.imageId 
            : `img-${timestamp}-${random}`;

          // 2. Decodificar base64
          let base64Data = imageBase64;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }

          // 3. Determinar formato original
          let originalExt = 'webp'; // por defecto
          if (imageBase64.includes('image/jpeg') || imageBase64.includes('image/jpg')) {
            originalExt = 'jpg';
          } else if (imageBase64.includes('image/png')) {
            originalExt = 'png';
          } else if (imageBase64.includes('image/gif')) {
            originalExt = 'gif';
          }

          // 4. Intentar convertir a WebP (si no es GIF)
          let finalBase64 = base64Data;
          let finalExt = originalExt;
          let converted = false;

          // Cargar sharp si está disponible
          let sharp;
          try {
            sharp = require('sharp');
          } catch (e) {
            console.log(`[${requestId}] ⚠️ sharp no disponible, se mantendrá formato original`);
          }

          // Si tenemos sharp y no es GIF, convertir a WebP optimizado
          if (sharp && originalExt !== 'gif') {
            try {
              const buffer = Buffer.from(base64Data, 'base64');
              const webpBuffer = await sharp(buffer)
                .webp({ quality: 80, effort: 4 }) // Calidad 80% para buen balance
                .toBuffer();
              finalBase64 = webpBuffer.toString('base64');
              finalExt = 'webp';
              converted = true;
              console.log(`[${requestId}] ✅ Imagen convertida a WebP (optimizada)`);
            } catch (sharpError) {
              console.error(`[${requestId}] ⚠️ Error en conversión WebP:`, sharpError.message);
              // Seguimos con formato original
            }
          }

          // 5. Nombre del archivo
          const fileName = action === "replace" && req.body.fileName 
            ? req.body.fileName 
            : `${imageId}.${finalExt}`;

          // 6. Verificar si ya existe (para reemplazar)
          let sha = null;
          if (action === "replace") {
            try {
              const { data } = await octokit.repos.getContent({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: fileName,
                ref: BRANCH
              });
              sha = data.sha;
              console.log(`[${requestId}] 📝 Reemplazando imagen existente: ${fileName}`);
            } catch (error) {
              if (error.status !== 404) throw error;
              // Si no existe, actuamos como upload normal
              console.log(`[${requestId}] ⚠️ Imagen a reemplazar no encontrada, se creará nueva`);
            }
          }

          // 7. Subir a GitHub
          const commitMessage = action === "replace"
            ? `[UPDATE] Imagen reemplazada: ${fileName} por ${user.email || user.uid}`
            : `[ADD] Nueva imagen: ${fileName} por ${user.email || user.uid}`;

          const uploadResponse = await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: fileName,
            message: commitMessage,
            content: finalBase64,
            sha: sha, // Si hay sha, reemplaza; si no, crea nuevo
            branch: BRANCH
          });

          const imageUrl = `${BASE_URL}/${fileName}`;

          console.log(`[${requestId}] ✅ Imagen guardada: ${fileName}`);

          // 8. Trigger rebuild del sitio principal
          try {
            await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
              owner: "revista1919",
              repo: "revista1919.github.io",
              event_type: "rebuild-images",
              client_payload: {
                action: action,
                imageId: imageId,
                fileName: fileName,
                triggeredBy: user.uid
              }
            });
            console.log(`[${requestId}] 🔄 Rebuild triggered`);
          } catch (rebuildError) {
            console.error(`[${requestId}] ⚠️ Error en rebuild:`, rebuildError.message);
          }

          return res.json({
            success: true,
            imageId: imageId,
            fileName: fileName,
            url: imageUrl,
            extension: finalExt,
            converted: converted,
            originalFormat: originalExt !== finalExt ? originalExt : null,
            message: `Imagen ${action === 'replace' ? 'reemplazada' : 'subida'} exitosamente`
          });

        } catch (uploadError) {
          console.error(`[${requestId}] ❌ Error en upload:`, uploadError);
          throw uploadError;
        }
      }

      // ===== ELIMINAR IMAGEN =====
      if (action === "delete") {
        if (!imageId && !fileName) {
          return res.status(400).json({ error: "Se requiere imageId o fileName" });
        }

        // Buscar el archivo a eliminar
        let fileToDelete = fileName;
        if (!fileToDelete && imageId) {
          try {
            const { data } = await octokit.repos.getContent({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: "",
              ref: BRANCH
            });

            // Buscar imagen que comience con imageId
            const matchingFile = data.find(item => 
              item.type === 'file' && item.name.startsWith(imageId)
            );

            if (!matchingFile) {
              return res.status(404).json({ error: "Imagen no encontrada" });
            }

            fileToDelete = matchingFile.name;
          } catch (error) {
            return res.status(404).json({ error: "Error buscando la imagen" });
          }
        }

        if (!fileToDelete) {
          return res.status(400).json({ error: "No se pudo determinar el archivo a eliminar" });
        }

        try {
          // Obtener SHA del archivo
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: fileToDelete,
            ref: BRANCH
          });

          // Eliminar archivo
          await octokit.repos.deleteFile({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: fileToDelete,
            message: `[DELETE] Imagen eliminada: ${fileToDelete} por ${user.email || user.uid}`,
            sha: data.sha,
            branch: BRANCH
          });

          console.log(`[${requestId}] ✅ Imagen eliminada: ${fileToDelete}`);

          // Trigger rebuild
          try {
            await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
              owner: "revista1919",
              repo: "revista1919.github.io",
              event_type: "rebuild-images",
              client_payload: {
                action: "delete",
                fileName: fileToDelete,
                triggeredBy: user.uid
              }
            });
          } catch (rebuildError) {
            console.error(`[${requestId}] ⚠️ Error en rebuild:`, rebuildError.message);
          }

          return res.json({
            success: true,
            message: "Imagen eliminada exitosamente",
            fileName: fileToDelete
          });

        } catch (error) {
          if (error.status === 404) {
            return res.status(404).json({ error: "Imagen no encontrada" });
          }
          throw error;
        }
      }

      return res.status(400).json({ error: "Acción no válida" });

    } catch (err) {
      console.error(`[${requestId}] ❌ Error en manageImages:`, err);
      
      // Log error en Firestore
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'manageImages',
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
/* ===================== UPLOAD NEWS (ACTUALIZADO PARA GITHUB) ===================== */
exports.uploadNews = onRequest(
  { 
    secrets: [GEMINI_API_KEY, DEEPSEEK_API_KEY, GH_TOKEN], // Añadido GH_TOKEN
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

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] 🚀 uploadNews - Iniciando petición`);

    try {
      // Verificar que Octokit esté disponible
      if (!Octokit) {
        await loadDependencies();
        if (!Octokit) {
          return res.status(500).json({ error: "Servicio GitHub no disponible" });
        }
      }

      const idToken = req.headers.authorization?.split("Bearer ")[1];
      if (!idToken) {
        return res.status(401).json({ error: "No autorizado - Token requerido" });
      }

      let user;
      try {
        user = await admin.auth().verifyIdToken(idToken);
        console.log(`[${requestId}] ✅ Usuario autenticado: ${user.email || user.uid}`);
      } catch (authError) {
        console.error(`[${requestId}] ❌ Error verificando token:`, authError.message);
        return res.status(401).json({ error: "Token inválido" });
      }

      try {
        await validateRole(user.uid, "Director General");
        console.log(`[${requestId}] ✅ Rol verificado: Director General`);
      } catch (roleError) {
        return res.status(403).json({ error: "Se requiere rol de Director General" });
      }

      const { title, body, photo, language = "es" } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ error: "Faltan datos: title y body son requeridos" });
      }

      // Verificar que las dependencias de traducción estén cargadas
      if (!GoogleGenAI || !fetch) {
        await loadDependencies();
        if (!GoogleGenAI || !fetch) {
          return res.status(500).json({ error: "Servicios de traducción no disponibles" });
        }
      }

      const source = language.toLowerCase();
      const target = source === "es" ? "en" : "es";

      const titleSource = sanitizeInput(title);
      const bodySource = base64DecodeUnicode(body) || sanitizeInput(body);

      console.log(`[${requestId}] 📝 Iniciando traducción con DeepSeek (fallback Gemini)`);
      
      // Usar la función con fallback para el título
      const titleTarget = await translateText(titleSource, source, target);
      
      // Usar la función con fallback para el body
      const bodyTarget = await translateHtmlFragment(bodySource, source, target);

      // Preparar datos de la noticia
      const now = new Date();
      const fechaIso = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timestamp = now.getTime();
      
      // Generar slug
      const slug = generateSlug(titleSource);
      const slugWithDate = `${slug}-${fechaIso}`;

      // Crear objeto de noticia (mismo formato que el ejemplo)
      const newsItem = {
        titulo: source === "es" ? titleSource : titleTarget,
        cuerpo: Buffer.from(source === "es" ? bodySource : bodyTarget).toString("base64"),
        title: source === "es" ? titleTarget : titleSource,
        content: Buffer.from(source === "es" ? bodyTarget : bodySource).toString("base64"),
        fecha: fechaIso,
        fechaIso: fechaIso,
        photo: photo || "",
        timestamp: timestamp,
        slug: slugWithDate
      };

      console.log(`[${requestId}] 📝 Noticia preparada: ${newsItem.titulo}`);

      // Obtener Octokit y leer news.json actual
      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "news";
      const JSON_PATH = "news.json";
      const BRANCH = "main";

      // Función para obtener el JSON actual
      async function getCurrentNewsJson() {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: JSON_PATH,
            ref: BRANCH
          });
          
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          return {
            news: JSON.parse(content),
            sha: data.sha
          };
        } catch (error) {
          if (error.status === 404) {
            // Si no existe, crear array vacío
            return {
              news: [],
              sha: null
            };
          }
          throw error;
        }
      }

      // Función para guardar el JSON
      async function saveNewsJson(news, sha, commitMessage) {
        const content = Buffer.from(JSON.stringify(news, null, 2)).toString('base64');
        
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

      // Leer noticias actuales
      const { news: currentNews, sha } = await getCurrentNewsJson();
      
      // Añadir nueva noticia al inicio (más reciente primero)
      const updatedNews = [newsItem, ...currentNews];
      
      // Ordenar por timestamp descendente (por si acaso)
      updatedNews.sort((a, b) => b.timestamp - a.timestamp);

      // Guardar en GitHub
      const commitMessage = `[ADD] Nueva noticia: ${newsItem.titulo} por ${user.email || user.uid}`;
      await saveNewsJson(updatedNews, sha, commitMessage);
      
      console.log(`[${requestId}] ✅ Noticia guardada en GitHub. SHA actualizado: ${sha ? 'actualizado' : 'nuevo archivo'}`);

      // Trigger rebuild para el sitio principal
      try {
        await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
          owner: "revista1919",
          repo: "revista1919.github.io",
          event_type: "rebuild-news",
          client_payload: {
            action: "add",
            newsSlug: slugWithDate,
            triggeredBy: user.uid
          }
        });
        console.log(`[${requestId}] 🔄 Rebuild triggered for main site`);
      } catch (rebuildError) {
        console.error(`[${requestId}] ⚠️ Error en rebuild:`, rebuildError.message);
        // No fallamos la petición principal si el rebuild falla
      }

      return res.json({
        success: true,
        slug: slugWithDate,
        timestamp: timestamp,
        title_source: titleSource,
        title_target: titleTarget,
        message: "Noticia publicada exitosamente"
      });

    } catch (err) {
      console.error(`[${requestId}] ❌ Error en uploadNews:`, err);
      
      // Registrar error en Firestore para debugging
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'uploadNews',
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
/* ===================== MANAGE ARTICLES COMPLETO CON HISTORIAL INMUTABLE Y RETRACTACIÓN (SIN DOI) ===================== */
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

      const { action, article, pdfBase64, id, retractionReason } = req.body;
      // 👇 AÑADE ESTO PARA DEPURAR
console.log(`[${requestId}] 📝 Datos del artículo recibidos:`, {
  titulo: article?.titulo,
  doi: article?.doi, // 👈 VERIFICA QUE LLEGA
  tieneDOI: article?.doi !== undefined,
  doiTipo: typeof article?.doi,
  doiValor: JSON.stringify(article?.doi)
});
      if (!action) {
        return res.status(400).json({ error: "Acción requerida (add/edit/delete/retract/publish)" });
      }

      console.log(`[${requestId}] 📋 Acción recibida: ${action}, ID: ${id || 'nuevo'}`);

      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "articless";
      const JSON_PATH = "articles.json";
      const BRANCH = "main";

            // Función para obtener el JSON actual
      async function getCurrentArticlesJson() {
        console.log(`[${requestId}] 📥 Intentando obtener articles.json...`);
        
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: JSON_PATH,
            ref: BRANCH
          });
          
          console.log(`[${requestId}] 📏 Tamaño del archivo: ${data.size} bytes`);
          
          if (data.size < 1000000 && data.content) {
            console.log(`[${requestId}] ✅ Usando contenido de API estándar`);
            
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            
            if (!content || content.trim() === '') {
              console.warn(`[${requestId}] ⚠️ Contenido vacío, intentando Git Database API...`);
              return await getCurrentArticlesJsonViaGitDatabase();
            }
            
            if (content.charCodeAt(0) === 0xFEFF) {
              content = content.slice(1);
            }
            
            try {
              const parsedContent = JSON.parse(content);
              console.log(`[${requestId}] ✅ JSON parseado: ${parsedContent.length} artículos`);
              return {
                articles: Array.isArray(parsedContent) ? parsedContent : [],
                sha: data.sha
              };
            } catch (parseError) {
              console.error(`[${requestId}] ❌ Error parseando JSON:`, parseError.message);
              return await getCurrentArticlesJsonViaGitDatabase();
            }
          }
          
          console.log(`[${requestId}] ⚠️ Archivo grande (${data.size} bytes), usando Git Database API`);
          return await getCurrentArticlesJsonViaGitDatabase();
          
        } catch (error) {
          if (error.status === 404) {
            console.log(`[${requestId}] 📝 articles.json no existe, se creará nuevo`);
            return {
              articles: [],
              sha: null
            };
          }
          
          console.error(`[${requestId}] ❌ Error en getContent:`, error.message);
          return await getCurrentArticlesJsonViaGitDatabase();
        }
      }

      // Función alternativa usando Git Database API para archivos grandes
      async function getCurrentArticlesJsonViaGitDatabase() {
        console.log(`[${requestId}] 📥 Usando Git Database API para obtener articles.json...`);
        
        try {
          // 1. Obtener la referencia del branch
          const { data: refData } = await octokit.git.getRef({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            ref: `heads/${BRANCH}`
          });
          
          const commitSha = refData.object.sha;
          console.log(`[${requestId}] ✅ Commit SHA: ${commitSha}`);
          
          // 2. Obtener el commit para conocer el SHA del árbol
          const { data: commitData } = await octokit.git.getCommit({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            commit_sha: commitSha
          });
          
          const treeSha = commitData.tree.sha;
          console.log(`[${requestId}] ✅ Tree SHA: ${treeSha}`);
          
          // 3. Obtener el árbol COMPLETO (recursivo)
          const { data: treeData } = await octokit.git.getTree({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            tree_sha: treeSha,
            recursive: 1
          });
          
          console.log(`[${requestId}] ✅ Árbol obtenido: ${treeData.tree.length} elementos`);
          
          // 4. Buscar el archivo en el árbol completo
          const fileEntry = treeData.tree.find(item => item.path === JSON_PATH);
          
          if (!fileEntry) {
            console.log(`[${requestId}] 📝 articles.json no encontrado en el árbol`);
            return {
              articles: [],
              sha: null
            };
          }
          
          console.log(`[${requestId}] ✅ Archivo encontrado. SHA: ${fileEntry.sha}`);
          
          // 5. Obtener el blob del archivo
          const { data: blobData } = await octokit.git.getBlob({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            file_sha: fileEntry.sha
          });
          
          let content;
          if (blobData.encoding === 'base64') {
            content = Buffer.from(blobData.content, 'base64').toString('utf8');
          } else {
            content = blobData.content;
          }
          
          console.log(`[${requestId}] 📏 Blob decodificado: ${content.length} caracteres`);
          
          if (!content || content.trim() === '') {
            console.warn(`[${requestId}] ⚠️ El blob está vacío`);
            return {
              articles: [],
              sha: fileEntry.sha
            };
          }
          
          if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
          }
          
          try {
            const parsedContent = JSON.parse(content);
            console.log(`[${requestId}] ✅ JSON parseado: ${parsedContent.length} artículos`);
            return {
              articles: Array.isArray(parsedContent) ? parsedContent : [],
              sha: fileEntry.sha
            };
          } catch (parseError) {
            console.error(`[${requestId}] ❌ Error parseando blob:`, parseError.message);
            console.error(`[${requestId}] 📄 Primeros 200 caracteres:`, content.substring(0, 200));
            return {
              articles: [],
              sha: fileEntry.sha
            };
          }
        } catch (error) {
          console.error(`[${requestId}] ❌ Error en Git Database API:`, error.message);
          throw error;
        }
      }

      // Función para guardar el JSON
      async function saveArticlesJson(articles, sha, commitMessage) {
        const content = JSON.stringify(articles, null, 2);
        const contentBuffer = Buffer.from(content, 'utf8');
        
        console.log(`[${requestId}] 📏 Tamaño del contenido a guardar: ${contentBuffer.length} bytes`);
        
        if (contentBuffer.length < 1000000) {
          console.log(`[${requestId}] ✅ Usando API estándar para guardar`);
          
          const contentBase64 = contentBuffer.toString('base64');
          
          const params = {
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: JSON_PATH,
            message: commitMessage,
            content: contentBase64,
            branch: BRANCH
          };
          
          if (sha) {
            params.sha = sha;
          }
          
          await octokit.repos.createOrUpdateFileContents(params);
          console.log(`[${requestId}] ✅ Archivo guardado con API estándar`);
        } else {
          console.log(`[${requestId}] ⚠️ Archivo grande, usando Git Database API para guardar`);
          
          try {
            // 1. Obtener la referencia actual del branch
            const { data: refData } = await octokit.git.getRef({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              ref: `heads/${BRANCH}`
            });
            
            const currentCommitSha = refData.object.sha;
            console.log(`[${requestId}] ✅ Commit actual: ${currentCommitSha}`);
            
            // 2. Obtener el commit para conocer el árbol base
            const { data: currentCommitData } = await octokit.git.getCommit({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              commit_sha: currentCommitSha
            });
            
            const baseTreeSha = currentCommitData.tree.sha;
            console.log(`[${requestId}] ✅ Árbol base: ${baseTreeSha}`);
            
            // 3. Crear el blob con el nuevo contenido
            const { data: blobData } = await octokit.git.createBlob({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              content: content,
              encoding: 'utf-8'
            });
            
            console.log(`[${requestId}] ✅ Blob creado: ${blobData.sha}`);
            
            // 4. Crear el árbol con base_tree para no borrar otros archivos
            const { data: treeData } = await octokit.git.createTree({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              base_tree: baseTreeSha,
              tree: [{
                path: JSON_PATH,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha
              }]
            });
            
            console.log(`[${requestId}] ✅ Árbol creado: ${treeData.sha}`);
            
            // 5. Crear el commit
            const { data: commitData } = await octokit.git.createCommit({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              message: commitMessage,
              tree: treeData.sha,
              parents: [currentCommitSha]
            });
            
            console.log(`[${requestId}] ✅ Commit creado: ${commitData.sha}`);
            
            // 6. Actualizar la referencia del branch
            await octokit.git.updateRef({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              ref: `heads/${BRANCH}`,
              sha: commitData.sha,
              force: false
            });
            
            console.log(`[${requestId}] 🚀 Branch actualizado exitosamente`);
            
          } catch (error) {
            console.error(`[${requestId}] ❌ Error guardando archivo grande:`, error.message);
            throw error;
          }
        }
      }

// Función auxiliar para obtener el SHA del commit actual
async function getCurrentCommitSha() {
  const { data } = await octokit.git.getRef({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    ref: `heads/${BRANCH}`
  });
  return data.object.sha;
}
      // En la función processAuthors dentro de exports.manageArticles
function processAuthors(authorsInput) {
  let authorsArray = [];
  
  if (typeof authorsInput === 'string') {
    authorsArray = authorsInput.split(';').map((name, index) => ({
      name: name.trim(),
      authorId: null,
      isCorresponding: index === 0, // El primero es correspondiente por defecto si es string
      email: null,
      institution: null,
      orcid: null,
      contribution: ''
    }));
  } else if (Array.isArray(authorsInput)) {
    if (authorsInput.length === 0) return [];
    
    if (typeof authorsInput[0] === 'string') {
      authorsArray = authorsInput.map((name, index) => ({
        name: name.trim(),
        authorId: null,
        isCorresponding: index === 0,
        email: null,
        institution: null,
        orcid: null,
        contribution: ''
      }));
    } else {
      // Objetos de autor - preservar TODOS los campos
      authorsArray = authorsInput.map(a => ({
        name: a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim(),
        authorId: a.authorId || a.uid || null,
        email: a.email || null,
        institution: a.institution || null,
        orcid: a.orcid || null,
        // *** AÑADIR ESTOS CAMPOS ***
        isCorresponding: a.isCorresponding || false,
        contribution: a.contribution || ''
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
// Después de la función getNextArticleNumber, agrega esta nueva función:
async function getSubmissionLanguage(submissionId) {
  if (!submissionId) {
    console.log(`[${requestId}] ⚠️ No hay submissionId, no se puede obtener idioma`);
    return 'es'; // Valor por defecto
  }
  
  try {
    const submissionDoc = await admin.firestore()
      .collection('submissions')
      .doc(submissionId)
      .get();
    
    if (submissionDoc.exists) {
      const data = submissionDoc.data();
      const language = data.paperLanguage || 'es';
      console.log(`[${requestId}] 📝 Idioma obtenido de submission ${submissionId}: ${language}`);
      return language;
    } else {
      console.log(`[${requestId}] ⚠️ Submission ${submissionId} no encontrado`);
      return 'es';
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error obteniendo idioma de submission:`, error.message);
    return 'es'; // Valor por defecto en caso de error
  }
}
      const { articles: currentArticles, sha } = await getCurrentArticlesJson();
      let updatedArticles = [...currentArticles];
      let responseData = {};

      // ===== ACCIÓN: ADD (CREAR ARTÍCULO) =====
      if (action === "add") {
        if (!article?.titulo) {
          return res.status(400).json({ error: "Datos de artículo incompletos - título requerido" });
        }

        console.log(`[${requestId}] 📝 Creando nuevo artículo: ${article.titulo}`);

        const authorsArray = processAuthors(article.autores);
        const articleNumber = await getNextArticleNumber(currentArticles);
         const paperLanguage = await getSubmissionLanguage(article.submissionId);
        const newArticle = {
          numeroArticulo: articleNumber,
          titulo: article.titulo,
          tituloEnglish: article.tituloEnglish || '',
          doi: article.doi || '',
          language: paperLanguage, 
          autores: authorsArray,
          resumen: article.resumen,
          abstract: article.abstract || '',
                    palabras_clave: Array.isArray(article.palabras_clave) ? article.palabras_clave : 
                          (article.palabras_clave ? article.palabras_clave.split(';').map(k => k.trim()) : []),
          keywords_english: Array.isArray(article.keywords_english) ? article.keywords_english :
                           (article.keywords_english ? article.keywords_english.split(';').map(k => k.trim()) : []),
          specialized_codes: Array.isArray(article.specialized_codes) ? article.specialized_codes :
                            (article.specialized_codes ? article.specialized_codes.split(';').map(c => c.trim()) : []),
          keywords_vocabulary: article.keywords_vocabulary || '',
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
          createdBy: user.uid,
          status: "draft" // Estado inicial: borrador
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

      // ===== ACCIÓN: EDIT (EDITAR ARTÍCULO) =====
      if (action === "edit") {
        console.log(`[${requestId}] 🟢 ENTRÓ al bloque EDIT`);
        
        if (!id) {
          console.log(`[${requestId}] 🔴 EDIT falló: ID requerido`);
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
        
        if (index === -1) {
          console.log(`[${requestId}] 🔴 EDIT falló: Artículo #${articleNumber} no encontrado`);
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const oldArticle = updatedArticles[index];
         let paperLanguage = oldArticle.language;
  if (!paperLanguage && oldArticle.submissionId) {
    paperLanguage = await getSubmissionLanguage(oldArticle.submissionId);
  }
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
          language: paperLanguage || oldArticle.language || 'es',
          titulo: article.titulo || oldArticle.titulo,
          tituloEnglish: article.tituloEnglish !== undefined ? article.tituloEnglish : oldArticle.tituloEnglish,
          autores: authorsArray,
          doi: article.doi !== undefined ? article.doi : oldArticle.doi,
          resumen: article.resumen !== undefined ? article.resumen : oldArticle.resumen,
          abstract: article.abstract !== undefined ? article.abstract : oldArticle.abstract,
                    palabras_clave: article.palabras_clave ? 
            (Array.isArray(article.palabras_clave) ? article.palabras_clave : article.palabras_clave.split(';').map(k => k.trim())) 
            : oldArticle.palabras_clave,
          keywords_english: article.keywords_english ?
            (Array.isArray(article.keywords_english) ? article.keywords_english : article.keywords_english.split(';').map(k => k.trim()))
            : oldArticle.keywords_english,
          specialized_codes: article.specialized_codes ?
            (Array.isArray(article.specialized_codes) ? article.specialized_codes : article.specialized_codes.split(';').map(c => c.trim()))
            : (oldArticle.specialized_codes || []),
          keywords_vocabulary: article.keywords_vocabulary !== undefined ? article.keywords_vocabulary : (oldArticle.keywords_vocabulary || ''),
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
          updatedBy: user.uid,
          status: oldArticle.status || "draft"
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
        
        console.log(`[${requestId}] 🟢 EDIT completado. Preparando respuesta exitosa...`);
      }

      // ===== ACCIÓN: DELETE (ELIMINAR ARTÍCULO) =====
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

      // ===== NUEVA ACCIÓN: PUBLISH (PUBLICAR ARTÍCULO - SIN DOI) =====
      // ===== ACCIÓN: PUBLISH (PUBLICAR ARTÍCULO - CREA SI NO EXISTE) =====
if (action === "publish") {
  console.log(`[${requestId}] 🟢 ENTRÓ al bloque PUBLISH`);
  
  let articleNumber;
  let existingArticle = null;
  
  // Verificar si el artículo ya existe (si se proporcionó ID)
  if (id) {
    articleNumber = parseInt(id);
    const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
    if (index !== -1) {
      existingArticle = updatedArticles[index];
      console.log(`[${requestId}] 📝 Editando y publicando artículo existente #${articleNumber}`);
    }
  }
  
  // Si NO existe el artículo (nuevo) o no se proporcionó ID, CREAR uno nuevo
  if (!existingArticle) {
    console.log(`[${requestId}] 📝 Creando NUEVO artículo para publicación inmediata`);
    
    // Validar datos mínimos
    if (!article?.titulo) {
      return res.status(400).json({ error: "Datos de artículo incompletos - título requerido" });
    }
      const paperLanguage = await getSubmissionLanguage(article.submissionId);
    const authorsArray = processAuthors(article.autores);
    articleNumber = await getNextArticleNumber(currentArticles);
    
    // Crear nuevo artículo
    const newArticle = {
      numeroArticulo: articleNumber,
      doi: article.doi || '',
      titulo: article.titulo,
      tituloEnglish: article.tituloEnglish || '',
      language: paperLanguage, 
      autores: authorsArray,
      resumen: article.resumen || '',
      abstract: article.abstract || '',
            palabras_clave: Array.isArray(article.palabras_clave) ? article.palabras_clave : 
                      (article.palabras_clave ? article.palabras_clave.split(';').map(k => k.trim()) : []),
      keywords_english: Array.isArray(article.keywords_english) ? article.keywords_english :
                       (article.keywords_english ? article.keywords_english.split(';').map(k => k.trim()) : []),
      specialized_codes: Array.isArray(article.specialized_codes) ? article.specialized_codes :
                        (article.specialized_codes ? article.specialized_codes.split(';').map(c => c.trim()) : []),
      keywords_vocabulary: article.keywords_vocabulary || '',
      area: article.area || '',
      tipo: article.tipo || 'Artículo de Investigación',
      type: article.type || 'Research Article',
      fecha: article.fecha || new Date().toISOString().split('T')[0],
      receivedDate: article.receivedDate || '',
      acceptedDate: article.acceptedDate || '',
      volumen: article.volumen || '',
      numero: article.numero || '',
      primeraPagina: article.primeraPagina || '',
      ultimaPagina: article.ultimaPagina || '',
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
      createdBy: user.uid,
      status: "published", // ← DIRECTAMENTE PUBLICADO
      publishedAt: new Date().toISOString(), // ← FECHA DE PUBLICACIÓN
      publishedBy: user.uid
    };
    
    // Subir PDF si existe
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
      success: true,
      articleNumber: articleNumber,
      message: "Artículo publicado exitosamente",
      isNew: true
    };
    
  } else {
    // Artículo existente - actualizar y publicar
    console.log(`[${requestId}] 📝 Actualizando y publicando artículo existente #${articleNumber}`);
    
    const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
    const oldArticle = updatedArticles[index];
      let paperLanguage = oldArticle.language;
  if (!paperLanguage && oldArticle.submissionId) {
    paperLanguage = await getSubmissionLanguage(oldArticle.submissionId);
  }
    let authorsArray;
    if (article.autores) {
      authorsArray = processAuthors(article.autores);
    } else {
      authorsArray = oldArticle.autores || [];
    }
    
    const updatedArticle = {
      ...oldArticle,
      language: paperLanguage || oldArticle.language || 'es',
      titulo: article.titulo || oldArticle.titulo,
      tituloEnglish: article.tituloEnglish !== undefined ? article.tituloEnglish : oldArticle.tituloEnglish,
      doi: article.doi !== undefined ? article.doi : oldArticle.doi,
      autores: authorsArray,
      resumen: article.resumen !== undefined ? article.resumen : oldArticle.resumen,
      abstract: article.abstract !== undefined ? article.abstract : oldArticle.abstract,
            palabras_clave: article.palabras_clave ? 
        (Array.isArray(article.palabras_clave) ? article.palabras_clave : article.palabras_clave.split(';').map(k => k.trim())) 
        : oldArticle.palabras_clave,
      keywords_english: article.keywords_english ?
        (Array.isArray(article.keywords_english) ? article.keywords_english : article.keywords_english.split(';').map(k => k.trim()))
        : oldArticle.keywords_english,
      specialized_codes: article.specialized_codes ?
        (Array.isArray(article.specialized_codes) ? article.specialized_codes : article.specialized_codes.split(';').map(c => c.trim()))
        : (oldArticle.specialized_codes || []),
      keywords_vocabulary: article.keywords_vocabulary !== undefined ? article.keywords_vocabulary : (oldArticle.keywords_vocabulary || ''),
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
      updatedBy: user.uid,
      status: "published", // ← FORZAR ESTADO PUBLICADO
      publishedAt: oldArticle.publishedAt || new Date().toISOString(), // Mantener fecha original si existe
      publishedBy: user.uid
    };
    
    // Manejar PDF si se subió uno nuevo
    if (pdfBase64) {
      try {
        if (oldArticle.pdfUrl) {
          const oldFileName = oldArticle.pdfUrl.split('/').pop();
          await deletePDF(oldFileName, `Delete old PDF for article #${articleNumber}`);
        }
        
        const slug = generateSlug(updatedArticle.titulo);
        const fileName = `Article-${slug}-${articleNumber}.pdf`;
        const pdfUrl = await uploadPDF(pdfBase64, fileName, `Update PDF for article #${articleNumber}`);
        updatedArticle.pdfUrl = pdfUrl;
      } catch (pdfError) {
        console.error(`[${requestId}] ❌ Error manejando PDF:`, pdfError.message);
      }
    }
    
    updatedArticles[index] = updatedArticle;
    responseData = { 
      success: true,
      articleNumber: articleNumber,
      message: "Artículo actualizado y publicado exitosamente",
      isNew: false
    };
  }
  
  console.log(`[${requestId}] 🟢 PUBLISH completado. Artículo #${articleNumber} publicado.`);
}

      // ===== NUEVA ACCIÓN: RETRACT (RETRACTAR ARTÍCULO - ELIMINA PERO GUARDA LOG) =====
      if (action === "retract") {
        console.log(`[${requestId}] 🟢 ENTRÓ al bloque RETRACT`);
        
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
        
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const articleToRetract = { ...updatedArticles[index] }; // Copia para el log
        console.log(`[${requestId}] 🔴 Retractando artículo #${articleNumber}: ${articleToRetract.titulo}`);

        // 1. Eliminar PDF si existe
        if (articleToRetract.pdfUrl) {
          try {
            const fileName = articleToRetract.pdfUrl.split('/').pop();
            console.log(`[${requestId}] 🗑️ Eliminando PDF: ${fileName}`);
            
            await deletePDF(
              fileName,
              `Delete PDF for retracted article #${articleNumber}: ${articleToRetract.titulo}`
            );
          } catch (pdfError) {
            console.error(`[${requestId}] ⚠️ Error eliminando PDF:`, pdfError.message);
          }
        }

        // 2. Eliminar el artículo del array
        updatedArticles.splice(index, 1);

        // 3. Guardar LOG DE RETRACTACIÓN en Firestore
        try {
          console.log(`[${requestId}] 📦 Guardando log de retractación...`);
          
          const retractionLog = {
            type: "ARTICLE_RETRACTION",
            articleNumber: articleNumber,
            article: articleToRetract,
            retractionReason: retractionReason || "No se proporcionó razón",
            retractedBy: user.uid,
            retractedByEmail: user.email || 'unknown',
            retractedAt: admin.firestore.FieldValue.serverTimestamp(),
            requestId: requestId,
            action: "retract"
          };

          await admin.firestore().collection('retractionLogs').add(retractionLog);
          console.log(`[${requestId}] ✅ Log de retractación guardado`);
          
        } catch (logError) {
          console.error(`[${requestId}] ⚠️ Error guardando log de retractación:`, logError.message);
          // No fallamos la operación principal si el log falla
        }

        responseData = { 
          success: true,
          articleNumber: articleNumber,
          message: "Artículo retractado y eliminado exitosamente",
          retracted: true
        };
        
        console.log(`[${requestId}] 🟢 RETRACT completado. Artículo eliminado y log guardado.`);
      }

      // ===== RESPUESTA FINAL Y GUARDADO PARA ACCIONES QUE MODIFICAN EL JSON =====
      if (["add", "edit", "publish", "delete", "retract"].includes(action)) {
        console.log(`[${requestId}] 🟢 Guardando cambios en GitHub para acción: ${action}`);
        
        updatedArticles.sort((a, b) => (a.numeroArticulo || 0) - (b.numeroArticulo || 0));
        
        let commitMessage;
        if (action === "retract") {
          commitMessage = `[RETRACT] Artículo retractado #${responseData.articleNumber} por ${user.email || user.uid}`;
        } else {
          commitMessage = `[${action}] Artículo ${action === 'add' ? 'agregado' : action === 'edit' ? 'actualizado' : action === 'publish' ? 'publicado' : 'eliminado'} #${responseData.articleNumber || ''} por ${user.email || user.uid}`;
        }
        
        await saveArticlesJson(updatedArticles, sha, commitMessage);
        console.log(`[${requestId}] ✅ articles.json actualizado en GitHub`);

        // ===== GENERAR HISTORIAL INMUTABLE (para acciones que finalizan/publican) =====
        if (["add", "edit", "publish"].includes(action)) {
          try {
            console.log(`[${requestId}] 📦 Generando historial inmutable para artículo #${responseData.articleNumber}...`);
            
            // Buscar el artículo en el array actualizado
            const targetArticle = updatedArticles.find(a => 
              String(a.numeroArticulo) === String(responseData.articleNumber)
            );
            
            if (targetArticle) {
              const historyResult = await createImmutableArticleHistory(
                targetArticle,
                user,
                action,
                requestId
              );
              
              console.log(`[${requestId}] ✅ Historial inmutable generado: ${historyResult.historyId}`);
              console.log(`[${requestId}] 🔒 Hash: ${historyResult.hash}`);
              
              // Añadir info del historial a la respuesta
              responseData.immutableHistory = {
                id: historyResult.historyId,
                hash: historyResult.hash,
                createdAt: new Date().toISOString()
              };
            }
          } catch (historyError) {
            // No fallar la petición principal si el historial falla, pero loguearlo
            console.error(`[${requestId}] ⚠️ Error generando historial inmutable:`, historyError.message);
            responseData.immutableHistoryError = historyError.message;
          }
        }

        // ===== TRIGGER REBUILD =====
        try {
          await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
            owner: "revista1919",
            repo: "revista1919.github.io",
            event_type: "rebuild-articles",
            client_payload: {
              action: action,
              articleNumber: responseData.articleNumber,
              triggeredBy: user.uid,
              immutableHistoryId: responseData.immutableHistory?.id
            }
          });
          console.log(`[${requestId}] 🔄 Rebuild triggered for main site`);
        } catch (rebuildError) {
          console.error(`[${requestId}] ⚠️ Error en rebuild:`, rebuildError.message);
        }

        console.log(`[${requestId}] 🟢 Enviando respuesta exitosa...`);
        
        return res.json({ 
          success: true,
          ...responseData
        });
      }

      // Si llegamos aquí, acción no válida
      console.log(`[${requestId}] 🔴 Acción inválida: "${action}"`);
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

/// ===================== FUNCIÓN AUXILIAR PARA CREAR HISTORIAL INMUTABLE (CON DOI) =====================
async function createImmutableArticleHistory(article, user, action, requestId) {
  try {
    const db = admin.firestore();
    const crypto = require('crypto');
    
    console.log(`[${requestId}] 📦 Construyendo objeto de historial inmutable...`);
    console.log(`[${requestId}] 📋 DOI recibido: "${article.doi || 'NO DOI'}"`);
    
    // 1. Buscar si ya existe un historial para este artículo
    const existingHistoryQuery = await db.collection('immutableHistories')
      .where('articleNumber', '==', article.numeroArticulo)
      .orderBy('control.createdAt', 'desc')
      .limit(1)
      .get();
    
    let previousHistoryId = null;
    let previousHistory = null;
    if (!existingHistoryQuery.empty) {
      previousHistoryId = existingHistoryQuery.docs[0].id;
      previousHistory = existingHistoryQuery.docs[0].data();
      console.log(`[${requestId}] 📚 Versión anterior encontrada: ${previousHistoryId}`);
    }
    
    // 2. Procesar autores para formato final
    const processedAuthors = (article.autores || []).map(author => ({
      name: author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim(),
      authorId: author.authorId || null,
      email: author.email || null,
      institution: author.institution || null,
      orcid: author.orcid || null,
      isCorresponding: author.isCorresponding || false,
      contribution: author.contribution || '',
      fullName: author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim()
    }));
    
    // 3. Procesar palabras clave (normalizar a array)
    const processKeywords = (keywordsInput) => {
      if (!keywordsInput) return [];
      if (Array.isArray(keywordsInput)) {
        return keywordsInput.map(k => typeof k === 'string' ? k.trim() : String(k)).filter(Boolean);
      }
      if (typeof keywordsInput === 'string') {
        return keywordsInput.split(';').map(k => k.trim()).filter(Boolean);
      }
      return [];
    };
    
    const keywordsArray = processKeywords(article.palabras_clave);
    const keywordsEnArray = processKeywords(article.keywords_english);
    const specializedCodesArray = processKeywords(article.specialized_codes);
    
    // 4. Construir el objeto de historia
    const immutableHistory = {
      version: "2.0.0", // Versión actualizada para incluir DOI
      schemaVersion: 2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: user.uid,
      createdByEmail: user.email || 'unknown',
      createdByDisplayName: user.displayName || user.email || 'unknown',
      createdByAction: action,
      requestId: requestId,
      
      // Identificadores del artículo
      articleNumber: article.numeroArticulo,
      submissionId: article.submissionId || null,
      
      // METADATOS FINALES DEL ARTÍCULO
      finalMetadata: {
        // Identidad
        title: article.titulo || '',
        titleEn: article.tituloEnglish || '',
        doi: article.doi || '', // ← AHORA INCLUYE DOI
        
        // Autores
        authors: processedAuthors,
        authorsCount: processedAuthors.length,
        
        // Contenido académico
                // Contenido académico
        abstract: article.resumen || '',
        abstractEn: article.abstract || '',
        keywords: keywordsArray,
        keywordsEn: keywordsEnArray,
        keywordsCount: keywordsArray.length,
        keywordsEnCount: keywordsEnArray.length,
        specializedCodes: specializedCodesArray,
        specializedCodesCount: specializedCodesArray.length,
        keywordsVocabulary: article.keywords_vocabulary || '',
        
        // Clasificación
        area: article.area || '',
        tipo: article.tipo || 'Artículo de Investigación',
        type: article.type || 'Research Article',
        
        // Fechas
        fecha: article.fecha || '',
        receivedDate: article.receivedDate || '',
        acceptedDate: article.acceptedDate || '',
        
        // Publicación
        publication: {
          volumen: article.volumen || '',
          numero: article.numero || '',
          primeraPagina: article.primeraPagina || '',
          ultimaPagina: article.ultimaPagina || '',
          pdfUrl: article.pdfUrl || '',
          totalPages: article.primeraPagina && article.ultimaPagina ? 
            (parseInt(article.ultimaPagina) - parseInt(article.primeraPagina) + 1) : 0
        },
        
        // Declaraciones
        acknowledgments: article.acknowledgments || '',
        acknowledgmentsEnglish: article.acknowledgmentsEnglish || '',
        funding: article.funding || 'No declarada',
        fundingEnglish: article.fundingEnglish || 'Not declared',
        conflicts: article.conflicts || 'Los autores declaran no tener conflictos de interés.',
        conflictsEnglish: article.conflictsEnglish || 'The authors declare no conflicts of interest.',
        
        // Contribuciones
        authorCredits: article.authorCredits || '',
        authorCreditsEnglish: article.authorCreditsEnglish || '',
        
        // Datos
        dataAvailability: article.dataAvailability || '',
        dataAvailabilityEnglish: article.dataAvailabilityEnglish || '',
        
        // Contenido HTML
        html_es: article.html_es || '',
        html_en: article.html_en || '',
        html_esLength: (article.html_es || '').length,
        html_enLength: (article.html_en || '').length,
        
        // Referencias
        referencias: article.referencias || '',
        referenciasLength: (article.referencias || '').length
      },
      
      // METADATOS DE CONTROL Y AUDITORÍA
      control: {
        createdBy: user.uid,
        createdByEmail: user.email || 'unknown',
        createdByDisplayName: user.displayName || user.email || 'unknown',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtISO: new Date().toISOString(),
        lastAction: action,
        previousHistoryId: previousHistoryId || null,
        isLatest: true,
        articleStatus: article.status || 'published',
        publishedAt: article.publishedAt || new Date().toISOString(),
        publishedBy: article.publishedBy || user.uid
      },
      
      // TRAZABILIDAD
      traceability: {
        previousVersions: previousHistoryId ? [previousHistoryId] : [],
        previousHash: previousHistory ? previousHistory.hash : null,
        totalVersions: previousHistory ? (previousHistory.control?.totalVersions || 1) + 1 : 1
      },
      
      // HASH (se calculará después)
      hash: null,
      
      // INFORMACIÓN ADICIONAL DEL SISTEMA
      system: {
        functionVersion: "2.0.0",
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
    
    // 5. Si existe un historial anterior, marcarlo como no latest
    if (previousHistoryId) {
      console.log(`[${requestId}] 📝 Actualizando historial anterior ${previousHistoryId}...`);
      await db.collection('immutableHistories').doc(previousHistoryId).update({
        'control.isLatest': false,
        'control.supersededBy': null, // Se actualizará después
        'control.supersededAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // 6. Calcular hash SHA-256 del contenido
    const hashObj = { ...immutableHistory };
    // Excluir campos que no son parte del contenido inmutable
    delete hashObj.hash;
    delete hashObj.createdAt;
    delete hashObj.control.createdAt;
    delete hashObj.system;
    delete hashObj.traceability;
    
    const hashString = JSON.stringify(hashObj, (key, value) => {
      // Manejar Timestamps de Firestore
      if (value && typeof value === 'object' && value.toDate) {
        return value.toDate().toISOString();
      }
      return value;
    });
    
    immutableHistory.hash = crypto
      .createHash('sha256')
      .update(hashString)
      .digest('hex');
    
    console.log(`[${requestId}] 🔒 Hash calculado: ${immutableHistory.hash.substring(0, 16)}...`);
    
    // 7. Guardar en Firestore
    let historyRef;
    if (previousHistoryId) {
      historyRef = await db.collection('immutableHistories').add(immutableHistory);
      
      // Actualizar el anterior con la referencia al nuevo
      await db.collection('immutableHistories').doc(previousHistoryId).update({
        'control.supersededBy': historyRef.id,
        'control.supersededAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`[${requestId}] 🔗 Historial anterior actualizado con referencia a: ${historyRef.id}`);
    } else {
      historyRef = await db.collection('immutableHistories').add(immutableHistory);
      console.log(`[${requestId}] 🆕 Primer historial creado para artículo #${article.numeroArticulo}`);
    }
    
        console.log(`[${requestId}] ✅ Historial guardado exitosamente:`);
    console.log(`[${requestId}]    - ID: ${historyRef.id}`);
    console.log(`[${requestId}]    - Artículo: #${article.numeroArticulo}`);
    console.log(`[${requestId}]    - Título: "${article.titulo?.substring(0, 50)}..."`);
    console.log(`[${requestId}]    - DOI: "${article.doi || 'NO ASIGNADO'}"`);
    console.log(`[${requestId}]    - Autores: ${processedAuthors.length}`);
    console.log(`[${requestId}]    - Keywords ES: ${keywordsArray.length}`);
    console.log(`[${requestId}]    - Keywords EN: ${keywordsEnArray.length}`);
    console.log(`[${requestId}]    - Códigos especializados: ${specializedCodesArray.length} (${article.keywords_vocabulary || 'N/A'})`);
    console.log(`[${requestId}]    - Versión: ${immutableHistory.traceability.totalVersions}`);
    console.log(`[${requestId}]    - Hash: ${immutableHistory.hash.substring(0, 16)}...`);
    // 8. Registrar en audit log del artículo (si existe submissionId)
    if (article.submissionId) {
      try {
        await db.collection('submissions').doc(article.submissionId)
          .collection('auditLogs').add({
                        action: 'immutable_history_created',
            historyId: historyRef.id,
            articleNumber: article.numeroArticulo,
            doi: article.doi || null,
            hash: immutableHistory.hash,
            version: immutableHistory.traceability.totalVersions,
            keywordsCount: keywordsArray.length,
            keywordsEnCount: keywordsEnArray.length,
            specializedCodesCount: specializedCodesArray.length,
            keywordsVocabulary: article.keywords_vocabulary || null,
            by: user.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
      } catch (auditError) {
        console.warn(`[${requestId}] ⚠️ Error guardando audit log:`, auditError.message);
      }
    }
    
    return {
      historyId: historyRef.id,
      hash: immutableHistory.hash,
      articleNumber: article.numeroArticulo,
      doi: article.doi || null,
      version: immutableHistory.traceability.totalVersions,
      createdAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error en createImmutableArticleHistory:`, error);
    console.error(`[${requestId}] 📋 Artículo:`, JSON.stringify({
      numeroArticulo: article.numeroArticulo,
      titulo: article.titulo,
      doi: article.doi
    }));
    throw error;
  }
}
// ===================== FUNCIÓN AUXILIAR PARA GENERAR SLUG =====================
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

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
    
    // ✅ Refrescar el token antes de crear los clientes
    await oauth2Client.getAccessToken();
    
    // ✅ Crear ambos clientes
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const docs = google.docs({ version: 'v1', auth: oauth2Client });  // ← AHORA SÍ SE USA
    
    console.log(`[${requestId}] ✅ Drive y Docs inicializados correctamente`);
    
    // ✅ RETORNAR AMBOS
    return { drive, docs, oauth2Client };
    
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
/* ===================== NUEVO: GENERAR DOCUMENTO PREMIUM CON LIBRERÍA DOCX + FUSIÓN ===================== */

// ===================== CONFIGURACIÓN =====================
const COLORS = {
  primary: "003B5C",
  accent: "E86125",
  textDark: "1F2937",
  textMuted: "64748B",
  border: "E2E8F0",
  bgLight: "F8FAFC"
};

// Configuración de tipografía estandarizada
const TYPOGRAPHY = {
  body: {
    font: "Georgia",
    size: 22, // 11pt
    color: COLORS.textDark,
    lineSpacing: 360, // 1.5
    alignment: "both"
  },
  heading1: {
    font: "Helvetica",
    size: 32, // 16pt
    color: COLORS.primary,
    bold: true,
    spacingBefore: 400,
    spacingAfter: 200
  },
  heading2: {
    font: "Helvetica",
    size: 28, // 14pt
    color: COLORS.primary,
    bold: true,
    spacingBefore: 300,
    spacingAfter: 150
  },
  heading3: {
    font: "Helvetica",
    size: 24, // 12pt
    color: COLORS.primary,
    bold: true,
    italic: true,
    spacingBefore: 250,
    spacingAfter: 100
  },
  heading4: {
    font: "Georgia",
    size: 22, // 11pt
    color: COLORS.textDark,
    bold: true,
    spacingBefore: 200,
    spacingAfter: 80
  }
};

// ===================== FUNCIONES AUXILIARES =====================
async function getLogoBuffer(language = 'es') {
  try {
    const logoUrl = language === 'es' 
      ? 'https://www.revistacienciasestudiantes.com/logo.png'
      : 'https://www.revistacienciasestudiantes.com/logoEN.png';
    
    if (!fetch) {
      console.warn('Fetch no disponible para obtener logo');
      return null;
    }
    
    const response = await fetch(logoUrl);
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('Error obteniendo logo:', error);
    return null;
  }
}
function createMetadataTable(submissionData, docxElements) {
  const { Table, TableRow, TableCell, Paragraph, TextRun, 
          BorderStyle, WidthType, VerticalAlign } = docxElements;
  
  // Bordes definidos como strings planos para máxima estabilidad
  const borderThick = { style: "single", size: 12, color: COLORS.primary };
  const borderNormal = { style: "single", size: 4, color: COLORS.border };

  const formatDate = () => {
    return new Date().toLocaleDateString('es-CL', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatKeywords = (kw) => {
    if (Array.isArray(kw)) {
      return kw.join('; ');
    }
    return kw || '';
  };

  const createRow = (label, value, isMonospace = false, isHeader = false) => {
    return new TableRow({
      tableHeader: isHeader,
      children: [
        // 1. CELDA DE LA ETIQUETA
        new TableCell({
          width: { size: 3159, type: WidthType.DXA },
          borders: {
            top: isHeader ? borderThick : borderNormal,
            bottom: borderNormal,
            left: borderNormal,
            right: borderNormal,
          },
          shading: {
            type: "solid", // ✅ Evita bug de fondo negro en Google Docs
            fill: isHeader ? COLORS.primary : COLORS.bgLight,
          },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 120, after: 120 }, // ✅ Padding vertical compatible
              children: [
                new TextRun({
                  text: label.toUpperCase(),
                  bold: true,
                  color: isHeader ? "FFFFFF" : COLORS.primary,
                  size: 16,
                  font: "Arial", // ✅ Fuente 100% compatible con Google Docs
                }),
              ],
            }),
          ],
        }),
        // 2. CELDA DEL VALOR
        new TableCell({
          width: { size: 5867, type: WidthType.DXA },
          borders: {
            top: isHeader ? borderThick : borderNormal,
            bottom: borderNormal,
            left: borderNormal,
            right: borderNormal,
          },
          shading: {
            type: "solid", // ✅ Consistencia de color
            fill: isHeader ? COLORS.primary : "FFFFFF",
          },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { before: 120, after: 120 }, // ✅ Padding vertical
              children: [
                new TextRun({
                  text: value || 'No especificado',
                  color: isHeader ? "FFFFFF" : COLORS.textDark,
                  size: 18,
                  font: isMonospace ? "Courier New" : "Arial", // ✅ Arial evita desconfiguración
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  // ✅ TABLA COMPATIBLE: Sin borders global para evitar herencia rota
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [3159, 5867],
    rows: [
      // Fila de encabezado
      createRow("Metadato", "Valor", false, true),
      // Filas de datos
      createRow("ID del Manuscrito", submissionData.submissionId, true),
      createRow("Fecha de Recepción", formatDate()),
      createRow("Área Temática", submissionData.area),
      createRow("Tipo de Artículo", (submissionData.articleType || '').toUpperCase()),
      createRow("Idioma del Texto", submissionData.paperLanguage === 'es' ? 'Español' : 'English'),
      createRow("Palabras Clave (ES)", formatKeywords(submissionData.keywordsEs)),
      createRow("Keywords (EN)", formatKeywords(submissionData.keywordsEn)),
      createRow("Códigos de Clasificación", `${submissionData.specializedCodesSerialized || ''} (${submissionData.keywordsVocabulario || 'N/A'})`),
    ],
  });
}
// ===================== GENERAR PORTADA PREMIUM =====================
async function generateCoverDocx(submissionData, requestId) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
          ImageRun, AlignmentType, BorderStyle, WidthType, HeadingLevel,
          VerticalAlign, PageBreak, PageOrientation } = docxLib;
  
  const docxElements = {
    Table, TableRow, TableCell, Paragraph, TextRun,
    BorderStyle, WidthType, VerticalAlign
  };
  
  const children = [];
  
  // Descargar logo
  let logoBuffer = null;
  try {
    logoBuffer = await getLogoBuffer(submissionData.paperLanguage || 'es');
  } catch (error) {
    console.warn(`[${requestId}] ⚠️ No se pudo descargar el logo:`, error.message);
  }
  
  // Logo
  if (logoBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 140, height: 140 },
          }),
        ],
      })
    );
  }
  
  // Título de la revista
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: submissionData.paperLanguage === 'es' 
            ? "REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES"
            : "THE NATIONAL REVIEW OF SCIENCES FOR STUDENTS",
          bold: true,
          color: COLORS.primary,
          size: 22,
          font: "Helvetica",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: submissionData.paperLanguage === 'es'
            ? "National Review of Sciences for Students"
            : "Revista Nacional de las Ciencias para Estudiantes",
          color: COLORS.textMuted,
          size: 16,
          font: "Helvetica",
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
      children: [
        new TextRun({
          text: "─────────",
          color: COLORS.accent,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: submissionData.title,
          bold: true,
          color: COLORS.primary,
          size: 28,
          font: "Georgia",
        }),
      ],
    })
  );
  
  if (submissionData.titleEn) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: submissionData.titleEn,
            italics: true,
            color: COLORS.textMuted,
            size: 20,
            font: "Georgia",
          }),
        ],
      })
    );
  }
  
  // Tabla de metadatos
  children.push(createMetadataTable(submissionData, docxElements));
  
  // Salto de página
  children.push(new Paragraph({ children: [new PageBreak()] }));
  
  // ========== RESUMEN ==========
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 4 }
      },
      children: [
        new TextRun({
          text: submissionData.paperLanguage === 'es' ? "RESUMEN" : "ABSTRACT",
          bold: true,
          color: COLORS.primary,
          size: 24,
          font: "Helvetica",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 300, line: 360 },
      children: [
        new TextRun({
          text: submissionData.abstract,
          color: COLORS.textDark,
          size: 22,
          font: "Georgia",
        }),
      ],
    })
  );
  
  if (Array.isArray(submissionData.keywordsEs) && submissionData.keywordsEs.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: "Palabras clave: ",
            bold: true,
            color: COLORS.primary,
            size: 20,
            font: "Helvetica",
          }),
          new TextRun({
            text: submissionData.keywordsEs.join(" · "),
            color: COLORS.textDark,
            size: 20,
            italics: true,
            font: "Georgia",
          }),
        ],
      })
    );
  }
  
  // ========== ABSTRACT ==========
  if (submissionData.abstractEn) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        borders: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 4 }
        },
        children: [
          new TextRun({
            text: "ABSTRACT",
            bold: true,
            color: COLORS.primary,
            size: 24,
            font: "Helvetica",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 300, line: 360 },
        children: [
          new TextRun({
            text: submissionData.abstractEn,
            color: COLORS.textDark,
            size: 22,
            font: "Georgia",
          }),
        ],
      })
    );
    
    if (Array.isArray(submissionData.keywordsEn) && submissionData.keywordsEn.length > 0) {
      children.push(
        new Paragraph({
          spacing: { after: 600 },
          children: [
            new TextRun({
              text: "Keywords: ",
              bold: true,
              color: COLORS.primary,
              size: 20,
              font: "Helvetica",
            }),
            new TextRun({
              text: submissionData.keywordsEn.join(" · "),
              color: COLORS.textDark,
              size: 20,
              italics: true,
              font: "Georgia",
            }),
          ],
        })
      );
    }
  }
  
  // Salto de página antes del contenido original
  children.push(new Paragraph({ children: [new PageBreak()] }));
  
  // Generar documento
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Georgia", size: 22, color: COLORS.textDark },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: children,
    }],
  });
  
  return await Packer.toBuffer(doc);
}

// ===================== ESTANDARIZAR ESTILOS =====================
async function standardizeStyles(originalZip) {
  console.log('🎨 Estandarizando tipografía...');
  
  try {
    const stylesPath = 'word/styles.xml';
    
    if (!originalZip.file(stylesPath)) {
      console.warn('⚠️ No se encontró styles.xml');
      return;
    }
    
    let stylesXml = await originalZip.file(stylesPath).async('string');
    
    // Estilo Normal
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:default="1" w:styleId="Normal">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
        <w:name w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:line="360" w:lineRule="auto"/>
          <w:jc w:val="both"/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.body.font}" w:hAnsi="${TYPOGRAPHY.body.font}" w:eastAsia="${TYPOGRAPHY.body.font}" w:cs="${TYPOGRAPHY.body.font}"/>
          <w:color w:val="${TYPOGRAPHY.body.color}"/>
          <w:sz w:val="${TYPOGRAPHY.body.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.body.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // Heading 1
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading1">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading1.spacingBefore}" w:after="${TYPOGRAPHY.heading1.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading1.font}" w:hAnsi="${TYPOGRAPHY.heading1.font}" w:eastAsia="${TYPOGRAPHY.heading1.font}" w:cs="${TYPOGRAPHY.heading1.font}"/>
          <w:b/>
          <w:color w:val="${TYPOGRAPHY.heading1.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading1.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading1.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // Heading 2
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading2">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading2">
        <w:name w:val="heading 2"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading2.spacingBefore}" w:after="${TYPOGRAPHY.heading2.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading2.font}" w:hAnsi="${TYPOGRAPHY.heading2.font}" w:eastAsia="${TYPOGRAPHY.heading2.font}" w:cs="${TYPOGRAPHY.heading2.font}"/>
          <w:b/>
          <w:color w:val="${TYPOGRAPHY.heading2.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading2.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading2.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // Heading 3
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading3">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading3">
        <w:name w:val="heading 3"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading3.spacingBefore}" w:after="${TYPOGRAPHY.heading3.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading3.font}" w:hAnsi="${TYPOGRAPHY.heading3.font}" w:eastAsia="${TYPOGRAPHY.heading3.font}" w:cs="${TYPOGRAPHY.heading3.font}"/>
          <w:b/>
          <w:i/>
          <w:color w:val="${TYPOGRAPHY.heading3.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading3.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading3.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // Heading 4
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading4">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading4">
        <w:name w:val="heading 4"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading4.spacingBefore}" w:after="${TYPOGRAPHY.heading4.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading4.font}" w:hAnsi="${TYPOGRAPHY.heading4.font}" w:eastAsia="${TYPOGRAPHY.heading4.font}" w:cs="${TYPOGRAPHY.heading4.font}"/>
          <w:b/>
          <w:color w:val="${TYPOGRAPHY.heading4.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading4.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading4.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    originalZip.file(stylesPath, stylesXml);
    console.log('✅ Tipografía estandarizada');
    
  } catch (error) {
    console.warn('⚠️ Error estandarizando estilos:', error.message);
  }
}

// ===================== FUSIONAR DOCX =====================
async function mergeDocxWithOriginal(coverDocxBuffer, originalBuffer, originalZip) {
  try {
    if (!jszipLib) {
      throw new Error('jszip no disponible');
    }
    
    console.log('📖 Leyendo portada premium...');
    const coverZip = await jszipLib.loadAsync(coverDocxBuffer);
    // ===================== FUSIONAR MEDIA =====================
    console.log('🖼️ Fusionando imágenes...');
    const coverMediaFolder = coverZip.folder('word/media');
    const originalMediaFolder = originalZip.folder('word/media');
    
    if (coverMediaFolder && originalMediaFolder) {
      const coverMediaFiles = Object.keys(coverMediaFolder.files);
      for (const filePath of coverMediaFiles) {
        if (coverMediaFolder.files[filePath].dir) continue;
        const fileName = filePath.split('/').pop();
        if (!originalZip.file(`word/media/${fileName}`)) {
          const content = await coverMediaFolder.files[filePath].async('nodebuffer');
          originalZip.file(`word/media/${fileName}`, content);
          console.log(`   ✅ ${fileName} copiado`);
        }
      }
    }
    
    // ===================== FUSIONAR RELACIONES =====================
    console.log('🔗 Fusionando relaciones...');
    const coverRelsPath = 'word/_rels/document.xml.rels';
    const originalRelsPath = 'word/_rels/document.xml.rels';
    
    const coverRels = await coverZip.file(coverRelsPath).async('string');
    let originalRels = await originalZip.file(originalRelsPath).async('string');
    
    const coverImageRels = coverRels.match(/<Relationship[^>]*Type="[^"]*\/image"[^>]*>/g) || [];
    
    let maxRId = 0;
    const allRIds = originalRels.match(/Id="rId(\d+)"/g) || [];
    for (const rId of allRIds) {
      const num = parseInt(rId.match(/\d+/)[0]);
      if (num > maxRId) maxRId = num;
    }
    
    const rIdMap = {};
    for (let i = 0; i < coverImageRels.length; i++) {
      const oldRId = coverImageRels[i].match(/Id="([^"]+)"/)[1];
      const newRId = `rId${maxRId + i + 1}`;
      rIdMap[oldRId] = newRId;
      
      const target = coverImageRels[i].match(/Target="([^"]+)"/)[1];
      const newRel = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
      originalRels = originalRels.replace('</Relationships>', `${newRel}</Relationships>`);
    }
    
    await originalZip.file(originalRelsPath, originalRels);
    
    // ===================== FUSIONAR DOCUMENT.XML =====================
    console.log('📄 Fusionando contenido...');
    const coverDocumentXml = await coverZip.file('word/document.xml').async('string');
    const originalDocumentXml = await originalZip.file('word/document.xml').async('string');
    
    let mergedCoverXml = coverDocumentXml;
    for (const [oldRId, newRId] of Object.entries(rIdMap)) {
      mergedCoverXml = mergedCoverXml.replace(new RegExp(`r:embed="${oldRId}"`, 'g'), `r:embed="${newRId}"`);
    }
    
    const coverBodyMatch = mergedCoverXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
    if (!coverBodyMatch) {
      throw new Error('No se encontró <w:body> en la portada');
    }
    
    const coverBodyContent = coverBodyMatch[1];
    
    const originalBodyMatch = originalDocumentXml.match(/(<w:body[^>]*>)/);
    if (!originalBodyMatch) {
      throw new Error('No se encontró <w:body> en el original');
    }
    
    const insertPosition = originalBodyMatch.index + originalBodyMatch[1].length;
    
    const newDocumentXml = 
      originalDocumentXml.substring(0, insertPosition) + 
      coverBodyContent + 
      originalDocumentXml.substring(insertPosition);
    
    await originalZip.file('word/document.xml', newDocumentXml);
    
    // ===================== ESTANDARIZAR ESTILOS =====================
    await standardizeStyles(originalZip);
    
    return originalZip;
    
  } catch (error) {
    console.error('❌ Error fusionando documentos:', error);
    throw error;
  }
}
// ============================================================
// FUNCIÓN AUXILIAR: CREAR CARPETA
// ============================================================
async function createFolder(drive, folderName, parentId = null) {
  try {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentId) {
      fileMetadata.parents = [parentId];
    }
    
    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, webViewLink, name'
    });
    
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

    const mimeType = fileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                     fileName.endsWith('.doc') ? 'application/msword' : 'application/octet-stream';

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    // 2. Crea el stream directamente desde el buffer usando Readable
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
        html: htmlBody,
        text: htmlBody.replace(/<[^>]*>/g, '') // Versión texto plano opcional
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

