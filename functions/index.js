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

      // --- EXTRACCIÓN COMPLETA DE TODOS LOS CAMPOS ---
            const {
    // Campos básicos del artículo
    title, titleEn, abstract, abstractEn, 
    keywordsEs, keywordsEn, area, paperLanguage = 'es',
    
    // NUEVO: Códigos especializados (universales, sin idioma)
    specializedCodes = [],
    specializedCodesSerialized,
    
    // NUEVO: Metadatos del vocabulario controlado
    keywordsVocabulario,        // "JEL" | "MeSH" | "ACM" | "UNESCO"
    
        // Autores
        authors, 
        
        // NUEVO: Autor de correspondencia (se detecta del array, pero también lo recibimos)
        correspondingAuthor,
        
        // Financiamiento y conflictos
        funding, conflictOfInterest,
        
        // Autores menores
        minorAuthors, 
        
        // Revisiones excluidas
        excludedReviewers,
        
        // Archivo manuscrito
        manuscriptBase64, manuscriptName,
        
        // Datos del autor que envía
        // Datos del usuario que sube (se guardan como submitter)
submitterName,
        
        // Tipo de artículo y agradecimientos
        articleType, acknowledgments,
        
        // NUEVO: Disponibilidad de datos y código
        dataAvailability, dataAvailabilityEn,
        codeAvailability, codeAvailabilityEn,
        
        // NUEVO: Campos de ética
        requiresEthicsApproval = false,
        ethicsCommitteeName,
        
        // NUEVO: Campos de IA
        aiUsed = false,
        aiTools = [],
        editorComment,
        // NUEVO: Declaraciones aceptadas (para auditoría)
        declarations,
        wantsToBeReviewer = false,
        reviewerAreas = []
      } = req.body;

      // --- VALIDACIONES ---

      // NUEVO: Validar disponibilidad de datos (obligatorio según política 8.1)
      if (!dataAvailability) {
        return res.status(400).json({ 
          error: 'Debes declarar la disponibilidad de los datos (Política 8.1)',
          missingFields: ['dataAvailability']
        });
      }

      // NUEVO: Validar que si requiere aprobación ética, venga el nombre del comité
      if (requiresEthicsApproval && !ethicsCommitteeName?.trim()) {
        return res.status(400).json({
          error: 'Debes especificar el nombre del comité de ética y el código de aprobación',
          missingFields: ['ethicsCommitteeName']
        });
      }

      // NUEVO: Validar que si usó IA, haya especificado las herramientas
      if (aiUsed && (!Array.isArray(aiTools) || aiTools.length === 0 || !aiTools.some(t => t.name?.trim() && t.purpose?.trim()))) {
        return res.status(400).json({
          error: 'Debes especificar al menos una herramienta de IA con su nombre y propósito (Política 7.3)',
          missingFields: ['aiTools']
        });
      }

// Validación de palabras clave en español (mínimo 2, máximo 6)
const totalKeywordsEs = Array.isArray(keywordsEs) ? keywordsEs.length : 0;
if (totalKeywordsEs < 2) {
    return res.status(400).json({
        error: 'Debes incluir al menos 2 palabras clave en español',
        missingFields: ['keywordsEs']
    });
}
if (totalKeywordsEs > 6) {
    return res.status(400).json({
        error: 'Máximo 6 palabras clave en español permitidas',
        missingFields: ['keywordsEs']
    });
}

// Validación de palabras clave en inglés (mínimo 2, máximo 6)
const totalKeywordsEn = Array.isArray(keywordsEn) ? keywordsEn.length : 0;
if (totalKeywordsEn < 2) {
    return res.status(400).json({
        error: 'Debes incluir al menos 2 keywords en inglés',
        missingFields: ['keywordsEn']
    });
}
if (totalKeywordsEn > 6) {
    return res.status(400).json({
        error: 'Máximo 6 keywords en inglés permitidas',
        missingFields: ['keywordsEn']
    });
}

// Validación de códigos especializados (2 a 4 códigos)
const totalCodes = Array.isArray(specializedCodes) ? specializedCodes.length : 0;
if (totalCodes < 2 || totalCodes > 4) {
    return res.status(400).json({
        error: 'Debes incluir entre 2 y 4 códigos especializados',
        missingFields: ['specializedCodes']
    });
}
      
      if (!Array.isArray(authors) || authors.length === 0) {
        return res.status(400).json({ error: 'Debe incluir al menos un autor' });
      }

      // Validar que haya al menos un autor de correspondencia
      const hasCorrespondingAuthor = authors.some(a => a.isCorresponding);
      if (!hasCorrespondingAuthor) {
        console.warn(`[${requestId}] ⚠️ No se especificó autor de correspondencia. Se usará el primer autor.`);
        // No es un error crítico, lo marcamos automáticamente
        authors[0].isCorresponding = true;
      }

      let submitterEmail = decodedToken.email;  // Email del que sube (autenticado)
const authorEmailToUse = correspondingAuthorData.email;  // Email del autor de correspondencia
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

      let drive, docs, oauth2Client;
try {
  const clients = await getDriveClient(requestId);
  drive = clients.drive;
  docs = clients.docs;
  oauth2Client = clients.oauth2Client;
} catch (driveError) {
        console.error(`[${requestId}] ❌ Error obteniendo cliente Drive:`, driveError);
        return res.status(500).json({ 
          error: 'Error en servicio de almacenamiento',
          requestId
        });
      }

      const safeTitle = title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
      
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

      // Carpeta 2: Para editores (revisión editorial)
      const editorialFolderName = `EDITORIAL_${submissionId}_${safeTitle}`;
      let editorialFolder;
      try {
        editorialFolder = await createDriveFolder(drive, editorialFolderName);
        console.log(`✅ Carpeta editorial creada: ${editorialFolderName} (${editorialFolder.id})`);
      } catch (folderError) {
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

      // Si hay carpeta editorial, crear un acceso directo simbólico
      if (editorialFolder) {
        try {
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

      console.log('🔒 Configurando permisos...');

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

      // Permiso para el autor en su propia carpeta (lectura)
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
        console.log(`✅ Permiso reader otorgado a autor: ${decodedToken.email}`);
      } catch (permErr) {
        console.error(`❌ Error permiso para autor:`, permErr.message);
      }

 
      // Hash de integridad del archivo
      const crypto = require('crypto');
      const fileBuffer = Buffer.from(manuscriptBase64, 'base64');
      const integrityHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // --- PROCESAMIENTO DE AUTORES ---
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
          isCorresponding: Boolean(author.isCorresponding)  // NUEVO: Se guarda explícitamente
        };

        if (!emailRegex.test(author.email)) {
          return res.status(400).json({ 
            error: `Email inválido para autor: ${author.firstName} ${author.lastName}`
          });
        }

        processedAuthors.push(authorData);
      }

      // NUEVO: Identificar autor de correspondencia
      const correspondingAuthorData = processedAuthors.find(a => a.isCorresponding) || processedAuthors[0];
      console.log(`📧 Autor de correspondencia: ${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName} (${correspondingAuthorData.email})`);

      // Procesar consentimientos de autores menores
           // Procesar consentimientos de autores menores
      if (Array.isArray(minorAuthors)) {
        for (const minor of minorAuthors) {
          if (minor.consentMethod === 'upload' && minor.consentFile?.data) {
            try {
              // Obtener nombre original del archivo
              const originalFileName = minor.consentFile.name || minor.consentFile.fileName || '';
              
              // Validar el archivo de consentimiento (PDF, DOC, DOCX)
              const base64Header = minor.consentFile.data.substring(0, 100);
              if (!isValidConsentFile(base64Header, originalFileName)) {
                console.error(`❌ Archivo de consentimiento inválido para ${minor.name}`);
                consentFiles.push({
                  author: minor.name,
                  method: 'upload',
                  error: 'Formato de archivo no soportado. Use PDF, DOC o DOCX'
                });
                continue; // Saltar al siguiente autor menor
              }
              
              // Obtener la extensión correcta
              const fileExt = getConsentFileExtension(originalFileName, base64Header);
              
              // Crear nombre seguro para el archivo
              const safeMinorName = minor.name.replace(/[^a-zA-Z0-9]/g, '_');
              const consentFileName = `CONSENT_${safeMinorName}_${Date.now()}${fileExt}`;
              
              // Verificar tamaño del archivo de consentimiento (máximo 5MB)
              const consentFileSize = Buffer.from(minor.consentFile.data, 'base64').length;
              const maxConsentSize = 5 * 1024 * 1024; // 5MB
              
              if (consentFileSize > maxConsentSize) {
                console.error(`❌ Archivo de consentimiento muy grande para ${minor.name}`);
                consentFiles.push({
                  author: minor.name,
                  method: 'upload',
                  error: 'El archivo excede el tamaño máximo de 5MB'
                });
                continue;
              }
              
              // Subir a Drive
              const consentFile = await uploadToDrive(
                drive, 
                minor.consentFile.data, 
                consentFileName, 
                authorFolder.id
              );

              // Registrar información completa del archivo
              consentFiles.push({
                author: minor.name,
                fileId: consentFile.id,
                fileUrl: consentFile.webViewLink,
                fileName: consentFileName,
                originalFileName: originalFileName || consentFileName,
                fileType: fileExt.replace('.', ''), // 'pdf', 'docx', 'doc'
                fileSize: consentFileSize,
                method: 'upload',
                uploadedAt: new Date().toISOString()
              });
              
              console.log(`✅ Consentimiento subido: ${consentFileName} (${fileExt})`);
              
            } catch (consentError) {
              console.error(`❌ Error subiendo consentimiento de ${minor.name}:`, consentError);
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

      // NUEVO: Procesar herramientas de IA
      const processedAITools = Array.isArray(aiTools) 
        ? aiTools.filter(t => t.name?.trim() && t.purpose?.trim()).map(t => ({
            name: sanitizeText(t.name),
            version: sanitizeText(t.version || 'No especificada'),
            purpose: sanitizeText(t.purpose)
          }))
        : [];

      // --- CONSTRUCCIÓN DEL DOCUMENTO PRINCIPAL DE FIRESTORE ---
      const submissionData = {
  submissionId,
  uid,
  authorUID: uid,
  
  // NUEVO: Datos del usuario que sube (solo para registro/auditoría)
  submitterEmail: decodedToken.email,  // Email del usuario autenticado
  submitterName: authorName || `${processedAuthors[0].firstName} ${processedAuthors[0].lastName}`.trim(),
  
  // NUEVO: Datos del autor de correspondencia (SE USAN PARA ENVIAR CORREOS)
  authorEmail: correspondingAuthorData.email,  // ← CAMBIO: Ahora es el email del autor de correspondencia
  authorName: `${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}`.trim(), 
        // Datos del artículo
        title: sanitizeText(title),
        titleEn: titleEn ? sanitizeText(titleEn) : null,
        abstract: sanitizeText(abstract),
        abstractEn: abstractEn ? sanitizeText(abstractEn) : null,
// Palabras clave (arrays simples de strings)
keywordsEs: Array.isArray(keywordsEs) ? keywordsEs : [],
keywordsEn: Array.isArray(keywordsEn) ? keywordsEn : [],

// Códigos especializados (universales, sin idioma)
specializedCodes: Array.isArray(specializedCodes) ? specializedCodes : [],
specializedCodesSerialized: specializedCodesSerialized || (Array.isArray(specializedCodes) ? specializedCodes.join('; ') : ''),

// Vocabulario controlado utilizado
keywordsVocabulario: keywordsVocabulario || 'unknown',
        area: sanitizeText(area),
        paperLanguage: paperLanguage === 'en' ? 'en' : 'es',
        
        // Tipo de artículo y agradecimientos
        articleType: articleType ? sanitizeText(articleType) : null,
        acknowledgments: acknowledgments ? sanitizeText(acknowledgments) : '',
        
        // NUEVO: Disponibilidad de datos y código
        dataAvailability: sanitizeText(dataAvailability),
        dataAvailabilityEn: dataAvailabilityEn ? sanitizeText(dataAvailabilityEn) : null,
        codeAvailability: codeAvailability ? sanitizeText(codeAvailability) : null,
        codeAvailabilityEn: codeAvailabilityEn ? sanitizeText(codeAvailabilityEn) : null,
        
        // NUEVO: Ética
        requiresEthicsApproval: Boolean(requiresEthicsApproval),
        ethicsCommitteeName: ethicsCommitteeName ? sanitizeText(ethicsCommitteeName) : null,
        
        // NUEVO: IA
        aiUsed: Boolean(aiUsed),
        aiTools: processedAITools,
        
        // Autores
        authors: processedAuthors,
        correspondingAuthor: {
          firstName: correspondingAuthorData.firstName,
          lastName: correspondingAuthorData.lastName,
          email: correspondingAuthorData.email,
          institution: correspondingAuthorData.institution,
          orcid: correspondingAuthorData.orcid
        },
        
        // Financiamiento y conflictos
        funding: funding || { hasFunding: false, sources: '', grantNumbers: '' },
        conflictOfInterest: conflictOfInterest ? sanitizeText(conflictOfInterest) : '',
        
        // Menores
        hasMinorAuthors: processedAuthors.some(a => a.isMinor),
        minorAuthors: sanitizedMinorAuthors,
        consentFiles,
        
        // Revisiones excluidas
        excludedReviewers: excludedReviewers 
          ? excludedReviewers.split(';').map(r => sanitizeText(r.trim())).filter(Boolean)
          : [],
        
        // NUEVO: Declaraciones aceptadas (para registro de auditoría)
        declarations: declarations || {},
        editorComment: editorComment || null,
        // Archivo original
        originalFileId: file.id,
        originalFileUrl: file.webViewLink,
        originalFileName: fileName,
        originalFileHash: integrityHash,
        originalFileSize: fileBuffer.length,
        
        // Carpetas de Drive
        driveFolderId: authorFolder.id,
        driveFolderUrl: authorFolder.webViewLink,
        editorialFolderId: editorialFolder ? editorialFolder.id : null,
        editorialFolderUrl: editorialFolder ? editorialFolder.webViewLink : null,
        wantsToBeReviewer: Boolean(wantsToBeReviewer),
  reviewerAreas: wantsToBeReviewer ? reviewerAreas : [],
  reviewerStatus: wantsToBeReviewer ? 'pending_review' : null,
  reviewerAppliedAt: wantsToBeReviewer ? admin.firestore.FieldValue.serverTimestamp() : null,
        
        // Estado y metadata
        status: 'submitted',
        currentRound: 1,
        
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        
        userAgent: req.headers['user-agent'] || null,
        ipAddress: clientIp,
        requestId
      };
// ============================================================
// NUEVO FLUJO: GENERAR DOCX PREMIUM FUSIONADO Y SUBIR A DRIVE
// ============================================================
// ============================================================
// NUEVO FLUJO: GENERAR DOCX PREMIUM FUSIONADO Y SUBIR A DRIVE
// ============================================================
let formattedDocsFile = null;
let formattedPdfFile = null;

try {
  console.log(`[${requestId}] 🎨 Generando documento premium...`);
  
  // 1. Verificar dependencias
  if (!docxLib) {
    console.log(`[${requestId}] ⏳ Cargando librería docx...`);
    await loadDependencies();
  }
  
  if (!docxLib) {
    throw new Error('docx lib no disponible');
  }
  
  // Verificar JSZip
  if (!jszipLib) {
    console.log(`[${requestId}] ⏳ Cargando jszip...`);
    await loadDependencies();
  }
  
  if (!jszipLib) {
    throw new Error('jszip no disponible');
  }
  // 2. Generar portada premium
  const coverDocxBuffer = await generateCoverDocx(submissionData, requestId);
  console.log(`[${requestId}] ✅ Portada premium generada`);
  
  // 3. Usar el base64 del manuscrito original que ya tenemos en memoria
  console.log(`[${requestId}] 📖 Leyendo documento original desde base64...`);
  
  // Limpiar el base64 si tiene prefijo
  let cleanManuscriptBase64 = manuscriptBase64;
  if (cleanManuscriptBase64.includes('base64,')) {
    cleanManuscriptBase64 = cleanManuscriptBase64.split('base64,')[1];
  }
  
  const originalBuffer = Buffer.from(cleanManuscriptBase64, 'base64');
  const originalZip = await jszipLib.loadAsync(originalBuffer);
  
  console.log(`[${requestId}] ✅ Documento original leído: ${(originalBuffer.length / 1024).toFixed(2)} KB`);
  
  // 4. Fusionar portada con original
  const mergedZip = await mergeDocxWithOriginal(coverDocxBuffer, originalBuffer, originalZip);
  
  // 5. Generar DOCX final
  const finalDocxBuffer = await mergedZip.generateAsync({ 
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  console.log(`[${requestId}] ✅ DOCX premium fusionado: ${(finalDocxBuffer.length / 1024).toFixed(2)} KB`);
  
  // 6. Subir DOCX a carpeta editorial
  if (editorialFolder) {
    try {
      const docStream = Readable.from(finalDocxBuffer);
      
      const docxUpload = await drive.files.create({
        requestBody: {
          name: `FORMATTED_${submissionId}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          parents: [editorialFolder.id]
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: docStream
        },
        fields: 'id, webViewLink'
      });
      
      formattedDocsFile = {
        id: docxUpload.data.id,
        url: docxUpload.data.webViewLink
      };
      
      console.log(`[${requestId}] ✅ DOCX premium subido a carpeta editorial`);
      
      // 7. Convertir a PDF para el autor
      try {
        const tempDocsFile = await drive.files.copy({
          fileId: docxUpload.data.id,
          requestBody: {
            name: `TEMP_${submissionId}`,
            mimeType: 'application/vnd.google-apps.document'
          },
          fields: 'id'
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pdfExport = await drive.files.export({
          fileId: tempDocsFile.data.id,
          mimeType: 'application/pdf'
        }, { responseType: 'arraybuffer' });
        
        const pdfBuffer = Buffer.from(pdfExport.data);
        const pdfStream = Readable.from(pdfBuffer);
        
        const pdfUpload = await drive.files.create({
          requestBody: {
            name: `FORMATTED_${submissionId}.pdf`,
            mimeType: 'application/pdf',
            parents: [authorFolder.id]
          },
          media: {
            mimeType: 'application/pdf',
            body: pdfStream
          },
          fields: 'id, webViewLink'
        });
        
        formattedPdfFile = {
          id: pdfUpload.data.id,
          url: pdfUpload.data.webViewLink
        };
        
        // Acceso directo al PDF en carpeta editorial
        if (editorialFolder) {
          await drive.files.create({
            resource: {
              name: `[PDF] FORMATTED_${submissionId}.pdf`,
              mimeType: 'application/vnd.google-apps.shortcut',
              parents: [editorialFolder.id],
              shortcutDetails: {
                targetId: pdfUpload.data.id
              }
            },
            fields: 'id'
          });
        }
        
        // Permisos del PDF
        try {
          await drive.permissions.create({
            fileId: pdfUpload.data.id,
            requestBody: {
              role: 'reader',
              type: 'user',
              emailAddress: decodedToken.email
            },
            sendNotificationEmail: false
          });
        } catch (permErr) {
          console.error(`⚠️ Error permiso PDF para autor:`, permErr.message);
        }
        
        for (const email of editorEmailsForPermissions) {
          try {
            await drive.permissions.create({
              fileId: pdfUpload.data.id,
              requestBody: {
                role: 'reader',
                type: 'user',
                emailAddress: email
              },
              sendNotificationEmail: false
            });
          } catch (permErr) {
            console.error(`⚠️ Error permiso PDF para ${email}:`, permErr.message);
          }
        }
        
        try {
          await drive.files.delete({
            fileId: tempDocsFile.data.id
          });
        } catch (deleteErr) {
          console.warn(`⚠️ No se pudo eliminar temporal:`, deleteErr.message);
        }
        
        console.log(`[${requestId}] ✅ PDF generado y subido`);
        
      } catch (pdfError) {
        console.warn(`[${requestId}] ⚠️ Error generando PDF:`, pdfError.message);
      }
      
      // Permisos del DOCX para editores
      for (const email of editorEmailsForPermissions) {
        try {
          await drive.permissions.create({
            fileId: docxUpload.data.id,
            requestBody: {
              role: 'writer',
              type: 'user',
              emailAddress: email
            },
            sendNotificationEmail: false
          });
        } catch (permErr) {
          console.error(`⚠️ Error permiso DOCX para ${email}:`, permErr.message);
        }
      }
      
    } catch (uploadError) {
      console.error(`[${requestId}] ⚠️ Error subiendo documento premium:`, uploadError.message);
    }
  }
  
} catch (formatError) {
  console.error(`[${requestId}] ⚠️ Error generando documento premium (no crítico):`, formatError.message);
}

// Agregar al submissionData los archivos formateados
submissionData.formattedDocsFile = formattedDocsFile;
submissionData.formattedPdfFile = formattedPdfFile;
submissionData.documentStatus = formattedDocsFile ? 'processed' : 'submitted';
      // --- TRANSACCIÓN EN FIRESTORE ---
      await db.runTransaction(async (transaction) => {
        // Documento principal del envío
        transaction.set(db.collection('submissions').doc(submissionId), submissionData);
        
        // Versión inicial del manuscrito
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
        
        // Log de auditoría
        transaction.set(db.collection('submissions').doc(submissionId).collection('auditLogs').doc(), {
  action: 'submission_created',
  by: uid,
  byEmail: decodedToken.email,  // Usuario autenticado
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  details: {
    submitterEmail: decodedToken.email,
    submitterName: submitterName,
    correspondingAuthorEmail: correspondingAuthorData.email,
    correspondingAuthorName: `${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}`,
            articleType,
            area,
            paperLanguage,
            hasFunding: funding?.hasFunding || false,
            aiUsed: Boolean(aiUsed),
            requiresEthicsApproval: Boolean(requiresEthicsApproval),
            hasMinorAuthors: processedAuthors.some(a => a.isMinor),
            dataAvailability,
            codeAvailability: codeAvailability || null,
            keywordsVocabulario: keywordsVocabulario || 'unknown',
keywordsEsCount: Array.isArray(keywordsEs) ? keywordsEs.length : 0,
keywordsEnCount: Array.isArray(keywordsEn) ? keywordsEn.length : 0,
specializedCodesCount: Array.isArray(specializedCodes) ? specializedCodes.length : 0,
hasEditorComment: !!editorComment,
editorCommentPreview: editorComment 
  ? editorComment.replace(/<[^>]*>/g, '').substring(0, 100) + (editorComment.length > 100 ? '...' : '') 
  : null,
  wantsToBeReviewer: Boolean(wantsToBeReviewer),
    reviewerAreasCount: wantsToBeReviewer ? reviewerAreas.length : 0,
          }
        });
        
        // Actualizar contador del usuario
        // Actualizar contador del usuario que sube (uid autenticado)
transaction.update(db.collection('users').doc(uid), {
  totalSubmissions: admin.firestore.FieldValue.increment(1),
  lastSubmissionAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
      });
      
      console.log(`✅ Datos guardados en Firestore`);

      // --- ENVÍO DE CORREOS ---
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

      // Correo a editores
      for (const editor of editorEmails) {
        const authorsList = processedAuthors.map(a => 
          `• ${a.firstName} ${a.lastName} (${a.email})${a.isCorresponding ? ' 📧 [CORRESPONDENCIA]' : ''}${a.isMinor ? ' 👶 [MENOR]' : ''}`
        ).join('<br>');

        const minorInfo = processedAuthors.some(a => a.isMinor) 
          ? `<p style="color: #b45309; background-color: #fffbeb; padding: 10px; border-left: 4px solid #d97706;">⚠️ Incluye autores menores - Revisar consentimientos</p>`
          : '';

        const fundingInfo = funding?.hasFunding 
          ? `<p><strong>Financiación:</strong> ${funding.sources || 'Sí'}${funding.grantNumbers ? ` (Subvención: ${funding.grantNumbers})` : ''}</p>`
          : '';

        // NUEVO: Información de ética
        const ethicsInfo = requiresEthicsApproval
          ? `<p style="color: #0A1929;"><strong>✅ Aprobación ética:</strong> ${ethicsCommitteeName || 'Declarada'}</p>`
          : '';
// Información de palabras clave para correos
const keywordsEsList = Array.isArray(keywordsEs) ? keywordsEs.join('; ') : '';
const keywordsEnList = Array.isArray(keywordsEn) ? keywordsEn.join('; ') : '';
const codesList = Array.isArray(specializedCodes) ? specializedCodes.join('; ') : '';

const keywordsInfo = `
    <p><strong>🏷️ Palabras clave (ES):</strong> ${keywordsEsList}</p>
    <p><strong>🏷️ Keywords (EN):</strong> ${keywordsEnList}</p>
    <p><strong>🔢 Códigos especializados (${keywordsVocabulario || 'Vocabulario'}):</strong> ${codesList}</p>
`;
        // NUEVO: Información de IA
        const aiInfo = aiUsed && processedAITools.length > 0
          ? `<p style="color: #0A1929;"><strong>🤖 IA utilizada:</strong> ${processedAITools.map(t => `${t.name} (${t.purpose})`).join(', ')}</p>`
          : '';

        // NUEVO: Disponibilidad de datos
        const availabilityInfo = `
          <p><strong>📊 Disponibilidad de datos:</strong> ${dataAvailability}</p>
          ${codeAvailability ? `<p><strong>💻 Disponibilidad de código:</strong> ${codeAvailability}</p>` : ''}
        `;

        // En el correo a editores, distinguir claramente:
const articleInfo = `
  <div class="highlight-box">
    <p class="article-title">"${sanitizeText(title)}"</p>
    ${minorInfo}
    <p><strong>ID:</strong> ${submissionId}</p>
    
    <p><strong>👤 Subido por:</strong> ${sanitizeText(submitterName || 'No especificado')}</p>
    <p><strong>📧 Email del que sube:</strong> ${submitterEmail}</p>
    
    <p><strong>📧 Autor de correspondencia:</strong> ${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName} (${correspondingAuthorData.email})</p>
    
    <p><strong>Área:</strong> ${sanitizeText(area)}</p>
    <p><strong>Tipo de artículo:</strong> ${articleType ? articleType.toUpperCase() : 'No especificado'}</p>
    <p><strong>Idioma:</strong> ${paperLanguage === 'es' ? 'Español' : 'Inglés'}</p>
    ${fundingInfo}
    ${ethicsInfo}
    ${aiInfo}
    ${availabilityInfo}
    ${keywordsInfo}
    <p><strong>Autores (${processedAuthors.length}):</strong><br>${authorsList}</p>
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

        // El correo de confirmación va al autor de correspondencia
emailPromises.push(
  sendEmailViaExtension(
    authorEmailToUse,  // ← Este es el email del autor de correspondencia
    paperLanguage === 'es' ? 'Confirmación de envío' : 'Submission confirmation',
    authorHtmlBody
  ).catch(err => console.log(`⚠️ Error email to corresponding author:`, err.message))
);
      }

      // Correo al autor
      const authorEmailTitle = paperLanguage === 'es' 
        ? '✅ Confirmación de envío'
        : '✅ Submission confirmation';

      const authorGreeting = paperLanguage === 'es'
  ? `Estimado/a ${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}:`
  : `Dear ${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}:`;

// En el cuerpo del correo, aclarar si es diferente al que sube
if (submitterEmail !== correspondingAuthorData.email) {
  authorBody += paperLanguage === 'es'
    ? `<p><em>Nota: Este artículo fue subido por ${submitterName} (${submitterEmail}).</em></p>`
    : `<p><em>Note: This article was submitted by ${submitterName} (${submitterEmail}).</em></p>`;
}
      let minorMessage = '';
      if (processedAuthors.some(a => a.isMinor)) {
        minorMessage = paperLanguage === 'es'
          ? `<p style="background-color: #fffbeb; padding: 15px; border-left: 4px solid #d97706;">
               <strong>📋 IMPORTANTE - AUTOR MENOR:</strong><br>
               Hemos recibido los documentos de consentimiento. Los revisaremos durante el proceso editorial.
             </p>`
          : `<p style="background-color: #fffbeb; padding: 15px; border-left: 4px solid #d97706;">
               <strong>📋 IMPORTANT - MINOR AUTHOR:</strong><br>
               We have received the consent documents. They will be reviewed during the editorial process.
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

      // NUEVO: Información de IA para el autor
      const aiAuthorMessage = aiUsed && processedAITools.length > 0
        ? (paperLanguage === 'es'
            ? `<p><strong>🤖 Uso de IA declarado:</strong> ${processedAITools.map(t => t.name).join(', ')}</p>`
            : `<p><strong>🤖 AI use declared:</strong> ${processedAITools.map(t => t.name).join(', ')}</p>`)
        : '';

      const authorBody = paperLanguage === 'es'
        ? `
          ${minorMessage}
          ${availabilityMessage}
          
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            <p><strong>ID de envío:</strong> ${submissionId}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
            <p><strong>Tipo de artículo:</strong> ${articleType ? articleType.toUpperCase() : 'No especificado'}</p>
            <p><strong>📧 Autor de correspondencia:</strong> ${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}</p>
            ${aiAuthorMessage}
          </div>
          
          <p>Hemos recibido tu artículo correctamente. El proceso de revisión comenzará en los próximos días.</p>
          
          <p><strong>Próximos pasos:</strong></p>
          <ol>
            <li>Revisión editorial inicial</li>
            <li>Verificación de similitud con PlagiarismGuard</li>
            <li>Asignación de revisores</li>
            <li>Revisión por pares doble ciego</li>
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
          ${keywordsInfo}
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            <p><strong>Submission ID:</strong> ${submissionId}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
            <p><strong>Article type:</strong> ${articleType ? articleType.toUpperCase() : 'Not specified'}</p>
            <p><strong>📧 Corresponding author:</strong> ${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}</p>
            ${aiAuthorMessage}
          </div>
          
          <p>We have received your article successfully. The review process will begin in the coming days.</p>
          
          <p><strong>Next steps:</strong></p>
          <ol>
            <li>Initial editorial review</li>
            <li>Similarity check with PlagiarismGuard</li>
            <li>Reviewer assignment</li>
            <li>Double-blind peer review</li>
          </ol>
          
          <p><strong>Your Google Drive folders:</strong></p>
          <ul>
            <li><a href="${authorFolder.webViewLink}">📁 Personal folder</a> (your original documents)</li>
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
        ).catch(err => console.log(`⚠️ Error email to author:`, err.message))
      );

      // Enviar correos en segundo plano
      Promise.allSettled(emailPromises).then(results => {
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`📧 Correos enviados: ${succeeded} exitosos, ${failed} fallidos`);
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Envío exitoso: ${submissionId} (${processingTime}ms)`);

      // NUEVO: Respuesta más completa
      return res.status(201).json({
  success: true,
  submissionId,
  driveFolderId: authorFolder.id,
  driveFolderUrl: authorFolder.webViewLink,
  editorialFolderUrl: editorialFolder ? editorialFolder.webViewLink : null,
  
  // Información clara de quién subió y quién es correspondencia
  submitter: {
    name: submitterName,
    email: submitterEmail
  },
  correspondingAuthor: {
    name: `${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}`,
    email: correspondingAuthorData.email
  },
  message: paperLanguage === 'es' 
    ? 'Artículo enviado correctamente. Se enviará confirmación al autor de correspondencia.'
    : 'Article submitted successfully. Confirmation will be sent to the corresponding author.',
  requestId
});

    } catch (error) {
      console.error(`[${requestId}] ❌ Error:`, error.message);
      console.error(`[${requestId}] Stack:`, error.stack);
      
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'submitArticle',
          error: { 
            message: error.message, 
            stack: error.stack,
            code: error.code || 'UNKNOWN'
          },
          requestId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error(`❌ Error al registrar error:`, logError.message);
      }
      
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

/**
 * 🔒 Maneja la creación de invitaciones de revisor con protecciones contra saturación
 * Reemplaza a onReviewerInvitationCreated con mejores prácticas de resiliencia
 */
exports.handleReviewerInvitationCreated = onDocumentCreated(
  { 
    document: 'reviewerInvitations/{invitationId}',
    timeoutSeconds: 540,
    memory: '512MB',
    retry: true,
    maxRetrySeconds: 1800  // 30 minutos máximo de reintentos
  },
  async (event) => {
    const functionStartTime = Date.now();
    const FUNCTION_TIMEOUT_MS = 500000; // ~8.3 min, menor que los 540s de timeout
    
    console.log('='.repeat(60));
    console.log(`🚀 [handleReviewerInvitationCreated] INICIO - ${new Date().toISOString()}`);
    
    // ===== PROTECCIÓN 1: Validación temprana =====
    if (!event?.data?.data) {
      console.error('❌ Evento inválido o sin datos');
      return;
    }

    const invitation = event.data.data();
    const invitationId = event.params.invitationId;

    if (!invitation?.reviewerEmail || !invitation?.submissionId) {
      console.error('❌ Datos de invitación incompletos:', { invitationId, ...invitation });
      return;
    }

    console.log(`📧 Procesando invitación ${invitationId} para ${invitation.reviewerEmail}`);

    // ===== PROTECCIÓN 2: Circuit Breaker simple =====
    const circuitBreakerKey = `invitation_processing_${invitationId}`;
    if (isCircuitBroken(circuitBreakerKey)) {
      console.warn(`⚠️ Circuito abierto para ${invitationId}, esperando reset...`);
      await delay(5000);
      if (isCircuitBroken(circuitBreakerKey)) {
        console.error('❌ Circuito sigue abierto, abortando');
        return;
      }
    }

    // ===== PROTECCIÓN 3: Timeout global de función =====
    const functionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_GLOBAL')), FUNCTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([
        processInvitationSafe(event, invitation, invitationId, functionStartTime),
        functionTimeout
      ]);
      
      console.log(`✅ Invitación ${invitationId} procesada en ${Date.now() - functionStartTime}ms`);
      
    } catch (error) {
      console.error('='.repeat(40));
      console.error(`❌ Error procesando invitación ${invitationId}:`, error.message);
      console.error('Stack:', error.stack?.substring(0, 500));
      
      // Registrar error pero no relanzar si ya marcamos como error
      if (error.message !== 'TIMEOUT_GLOBAL') {
        try {
          await Promise.race([
            logSystemError('handleReviewerInvitationCreated', error, { 
              invitationId, 
              duration: Date.now() - functionStartTime 
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('log_timeout')), 10000))
          ]);
        } catch (logError) {
          console.error('❌ No se pudo registrar el error:', logError.message);
        }
        
        // Marcar invitación como fallida para diagnóstico
        try {
          await Promise.race([
            event.data.ref.update({
              processingError: error.message,
              failedAt: admin.firestore.FieldValue.serverTimestamp()
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('update_timeout')), 5000))
          ]);
        } catch (updateError) {
          console.error('❌ No se pudo marcar error en documento:', updateError.message);
        }
      }
    } finally {
      console.log(`🏁 [handleReviewerInvitationCreated] FIN - ${Date.now() - functionStartTime}ms`);
      console.log('='.repeat(60));
    }
  }
);

/**
 * Procesa la invitación con múltiples capas de protección
 */
async function processInvitationSafe(event, invitation, invitationId, startTime) {
  const STAGE_TIMEOUT_MS = 120000; // 2 minutos por etapa
  
  // ===== ETAPA 1: Carga de dependencias con cold start handling =====
  console.log('📦 ETAPA 1: Verificando dependencias...');
  await executeWithTimeout(
    async () => {
      if (!admin?.firestore) {
        console.log('⏳ Cold start detectado, inicializando Firebase...');
        
        // Intentar inicializar con múltiples reintentos
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await initializeFirebaseSafe();
            console.log(`✅ Firebase inicializado (intento ${attempt})`);
            break;
          } catch (initError) {
            console.warn(`⚠️ Intento ${attempt}/3 falló:`, initError.message);
            if (attempt === 3) throw initError;
            await delay(2000 * attempt); // Backoff progresivo
          }
        }
      }
    },
    STAGE_TIMEOUT_MS,
    'ETAPA_1_TIMEOUT'
  );

  // ===== ETAPA 2: Obtención de datos del submission =====
  console.log('📚 ETAPA 2: Obteniendo datos del submission...');
  const submission = await executeWithTimeout(
    async () => {
      const db = admin.firestore();
      
      // Verificar conexión
      await db.collection('_health_check').doc('ping').get().catch(() => {
        throw new Error('Firebase no responde');
      });
      
      const submissionRef = db.collection('submissions').doc(invitation.submissionId);
      const submissionDoc = await submissionRef.get();
      
      if (!submissionDoc.exists) {
        throw new Error(`Submission no encontrado: ${invitation.submissionId}`);
      }
      
      return submissionDoc.data();
    },
    STAGE_TIMEOUT_MS,
    'ETAPA_2_TIMEOUT'
  );

  // ===== ETAPA 3: Verificar y limpiar duplicados =====
  console.log('🔍 ETAPA 3: Verificando duplicados...');
  await executeWithTimeout(
    async () => {
      const db = admin.firestore();
      
      // Verificar si ya existe un email enviado para este hash en los últimos 5 minutos
      const recentInvitations = await db.collection('reviewerInvitations')
        .where('inviteHash', '==', invitation.inviteHash)
        .where('emailSentAt', '>=', new Date(Date.now() - 5 * 60 * 1000))
        .limit(2)
        .get();
      
      if (recentInvitations.size > 1) {
        console.warn('⚠️ Posible duplicado detectado, verificando...');
        
        // Si otro documento YA tiene emailSentAt, este es duplicado
        const duplicate = recentInvitations.docs.find(doc => 
          doc.id !== invitationId && doc.data().emailSentAt
        );
        
        if (duplicate) {
          console.warn(`⚠️ Email ya enviado en documento ${duplicate.id}, marcando como duplicado`);
          await event.data.ref.update({
            isDuplicate: true,
            duplicateOf: duplicate.id,
            reason: 'Email ya enviado en otro documento con mismo hash'
          });
          throw new Error('DUPLICADO_DETECTADO');
        }
      }
      
      console.log('✅ No se detectaron duplicados activos');
    },
    60000,
    'ETAPA_3_TIMEOUT'
  );

  // ===== ETAPA 4: Construcción del email =====
  console.log('📝 ETAPA 4: Construyendo email...');
  const emailData = await executeWithTimeout(
    async () => {
      const lang = (submission.paperLanguage === 'en') ? 'en' : 'es';
      const isSpanish = lang === 'es';
      
      const baseUrl = 'https://www.revistacienciasestudiantes.com';
      const inviteLink = `${baseUrl}/reviewer-response?hash=${encodeURIComponent(invitation.inviteHash)}&lang=${lang}`;
      
      // Construir contenido del email
      const emailContent = buildInvitationEmail(invitation, submission, inviteLink, isSpanish);
      
      return {
        to: invitation.reviewerEmail,
        subject: isSpanish ? '📋 Invitación a revisión por pares' : '📋 Peer Review Invitation',
        html: emailContent,
        metadata: {
          invitationId,
          submissionId: invitation.submissionId,
          hash: invitation.inviteHash,
          lang
        }
      };
    },
    30000,
    'ETAPA_4_TIMEOUT'
  );

  // ===== ETAPA 5: Envío del email con reintentos =====
  console.log('📨 ETAPA 5: Enviando email...');
  await executeWithTimeout(
    async () => {
      // Reintentar envío hasta 3 veces
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sendEmailViaExtension(emailData.to, emailData.subject, emailData.html);
          console.log(`✅ Email enviado (intento ${attempt})`);
          break;
        } catch (sendError) {
          console.error(`❌ Intento ${attempt}/3 falló:`, sendError.message);
          if (attempt === 3) throw sendError;
          await delay(3000 * attempt * 2); // Backoff más agresivo
        }
      }
    },
    120000,
    'ETAPA_5_TIMEOUT'
  );

  // ===== ETAPA 6: Actualización final del documento =====
  console.log('💾 ETAPA 6: Actualizando documento...');
  await executeWithTimeout(
    async () => {
      const db = admin.firestore();
      const batch = db.batch();
      
      // Actualizar la invitación actual
      const invitationRef = db.collection('reviewerInvitations').doc(invitationId);
      batch.update(invitationRef, {
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteLink: `${baseUrl}/reviewer-response?hash=${encodeURIComponent(invitation.inviteHash)}&lang=${submission.paperLanguage || 'es'}`,
        processingTime: Date.now() - startTime,
        status: 'email_sent'
      });
      
      // Actualizar el submission para tracking
      const submissionRef = db.collection('submissions').doc(invitation.submissionId);
      batch.update(submissionRef, {
        [`reviewers.${invitationId}.invitationSentAt`]: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await batch.commit();
      console.log('✅ Documentos actualizados exitosamente');
    },
    30000,
    'ETAPA_6_TIMEOUT'
  );

  console.log(`✅ Procesamiento completo en ${Date.now() - startTime}ms`);
}

/**
 * Ejecuta una función con timeout y manejo de errores
 */
async function executeWithTimeout(fn, timeoutMs, errorCode) {
  let timeoutHandle;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${errorCode}: Timeout después de ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle);
    console.error(`⏰ Error en ${errorCode}:`, error.message);
    throw error;
  }
}

/**
 * Circuit Breaker simple para prevenir procesamiento repetido
 */
const circuitBreakerState = new Map();

function isCircuitBroken(key) {
  const state = circuitBreakerState.get(key);
  if (!state) return false;
  
  if (state.failures >= 3 && Date.now() - state.lastFailure < 60000) {
    return true; // Circuito abierto por 1 minuto
  }
  
  return false;
}

function recordCircuitFailure(key) {
  const state = circuitBreakerState.get(key) || { failures: 0, lastFailure: 0 };
  state.failures++;
  state.lastFailure = Date.now();
  circuitBreakerState.set(key, state);
}

function resetCircuitBreaker(key) {
  circuitBreakerState.delete(key);
}

/**
 * Inicializa Firebase de forma segura con reintentos
 */
async function initializeFirebaseSafe() {
  return new Promise((resolve, reject) => {
    try {
      // Verificar si ya está inicializado
      if (admin.apps.length) {
        resolve();
        return;
      }
      
      // Inicializar con configuración verificada
      admin.initializeApp();
      
      // Verificar que funcione
      const db = admin.firestore();
      db.collection('_health_check').doc('ping').get()
        .then(() => resolve())
        .catch(error => {
          console.error('Error verificando Firebase:', error);
          reject(error);
        });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Delay asíncrono
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Construye el HTML del email de invitación
 */
function buildInvitationEmail(invitation, submission, inviteLink, isSpanish) {
  const emailTitle = isSpanish
    ? '📋 Invitación a revisión por pares'
    : '📋 Peer Review Invitation';

  const emailGreeting = isSpanish
    ? `Estimado/a ${invitation.reviewerName || 'colega'}:`
    : `Dear ${invitation.reviewerName || 'colleague'}:`;

  const articleInfo = `
    <div class="highlight-box">
      <p class="article-title">"${escapeHtml(submission.title || 'Sin título')}"</p>
      <p><strong>${isSpanish ? 'Área:' : 'Area:'}</strong> ${escapeHtml(submission.area || 'No especificada')}</p>
      <p><strong>${isSpanish ? 'Resumen:' : 'Abstract:'}</strong> ${escapeHtml((submission.abstract || '').substring(0, 250))}${(submission.abstract || '').length > 250 ? '...' : ''}</p>
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

  return getEmailTemplate(
    emailTitle,
    emailGreeting,
    emailBodyContent,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    isSpanish ? 'es' : 'en'
  );
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ----------------------------------------------------------------------------
 * 4. TRIGGER: Cuando un revisor RESPONDE a una invitación (se actualiza)
 * ----------------------------------------------------------------------------
 */
// ===================== TRIGGER CORREGIDO - VERSIÓN LIMPIA =====================
exports.onReviewerInvitationUpdated = onDocumentUpdated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN],
    memory: '512MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invitationId = event.params.invitationId;

    // Solo proceder si el estado cambió de 'pending' a 'accepted'
    if (beforeData.status !== 'pending' || afterData.status !== 'accepted') {
      return;
    }

    console.log(`📝 [REVIEWER] Invitación ${invitationId} ACEPTADA. Creando copia exclusiva...`);

    try {
      const db = admin.firestore();
      const requestId = `REV-${invitationId}-${Date.now().toString().substring(0, 8)}`;
      const warnings = []; // Acumular warnings sin interrumpir

      // ===== PASO 1: Obtener el submission completo =====
      const submissionDoc = await db.collection('submissions').doc(afterData.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ Submission no encontrado: ${afterData.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();

      // ===== PASO 2: Verificar carpeta editorial =====
      if (!submission.editorialFolderId) {
        console.error(`❌ Submission sin editorialFolderId`);
        return;
      }

      // ===== PASO 3: Inicializar Google Drive =====
      let drive;
      try {
        const driveClients = await getDriveClient(`reviewer-${invitationId}`);
        drive = driveClients.drive;
        
        if (!drive?.files?.copy) {
          throw new Error('Cliente de Google Drive mal inicializado');
        }
      } catch (driveError) {
        console.error(`❌ Error inicializando Drive:`, driveError.message);
        await logSystemError('drive_init_failed', driveError, invitationId);
        return;
      }
      
      // ===== PASO 4: IDENTIFICAR DOCUMENTO FUENTE =====
      let sourceFileId = null;
      let sourceMimeType = null;
      
      try {
        if (submission.formattedDocsFile?.id) {
          sourceFileId = submission.formattedDocsFile.id;
          sourceMimeType = 'application/vnd.google-apps.document';
          console.log(`[${requestId}] ✅ Usando documento formateado (Google Docs)`);
        } else if (submission.originalFileId) {
          sourceFileId = submission.originalFileId;
          console.log(`[${requestId}] ⚠️ Submission antigua. Usando documento original.`);
          
          try {
            const fileMeta = await drive.files.get({
              fileId: sourceFileId,
              fields: 'mimeType'
            });
            sourceMimeType = fileMeta.data.mimeType;
          } catch (metaErr) {
            console.warn(`[${requestId}] ⚠️ No se pudo obtener MIME type. Asumiendo Word.`);
            sourceMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            warnings.push('mime_type_assumed');
          }
        } else {
          throw new Error(`No se encontró documento para submission ${afterData.submissionId}`);
        }
      } catch (sourceError) {
        console.error(`❌ Error identificando documento fuente:`, sourceError.message);
        await logSystemError('source_doc_error', sourceError, invitationId);
        return;
      }

      // ===== PASO 5: CREAR COPIA EXCLUSIVA PARA EL REVISOR =====
      console.log(`[${requestId}] 📄 Creando copia para revisor...`);
      
      let reviewerFileId, reviewerFileUrl;
      
      try {
        const reviewerUidShort = afterData.reviewerUid ? afterData.reviewerUid.substring(0, 8) : 'unknown';
        const reviewerCopyName = `REVIEW_${submission.submissionId}_${reviewerUidShort}`;
        
        const copyConfig = {
          fileId: sourceFileId,
          requestBody: {
            name: reviewerCopyName,
            parents: [submission.editorialFolderId],
            copyRequiresWriterPermission: true,
            writersCanShare: false
          },
          fields: 'id, webViewLink, mimeType'
        };
        
        if (sourceMimeType === 'application/vnd.google-apps.document') {
          copyConfig.requestBody.mimeType = 'application/vnd.google-apps.document';
        }
        
        const reviewerCopy = await drive.files.copy(copyConfig);
        
        reviewerFileId = reviewerCopy.data.id;
        reviewerFileUrl = reviewerCopy.data.webViewLink;
        
        console.log(`[${requestId}] ✅ Copia creada: ${reviewerFileId}`);
      } catch (copyError) {
        console.error(`❌ Error creando copia:`, copyError.message);
        await logSystemError('copy_creation_failed', copyError, invitationId);
        
        // Intentar crear la asignación igual sin archivo
        warnings.push('copy_failed');
        reviewerFileId = null;
        reviewerFileUrl = null;
      }

      // ===== PASO 6: CONFIGURAR PERMISOS (NO BLOQUEANTE) =====
      if (reviewerFileId) {
        try {
          console.log(`[${requestId}] 🔑 Configurando permisos...`);
          await configureReviewerPermissions(drive, reviewerFileId, afterData.reviewerEmail, requestId);
        } catch (permError) {
          console.warn(`[${requestId}] ⚠️ Error en permisos (no crítico):`, permError.message);
          warnings.push('permission_error');
          // Continuar a pesar del error de permisos
        }
      }

      // ===== PASO 7: CREAR ASIGNACIÓN EN FIRESTORE =====
      let assignmentRef;
      try {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 21);

        const assignmentData = {
          submissionId: afterData.submissionId,
          editorialReviewId: afterData.editorialReviewId || null,
          editorialTaskId: afterData.editorialTaskId || null,
          round: afterData.round || 1,
          reviewerUid: afterData.reviewerUid,
          reviewerEmail: afterData.reviewerEmail,
          reviewerName: afterData.reviewerName || 'Revisor',
          invitationId: invitationId,
          status: 'pending',
          conflictOfInterest: afterData.conflictOfInterest || false,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          dueDate: admin.firestore.Timestamp.fromDate(dueDate),
          
          // Documento exclusivo del revisor
          reviewerFileId: reviewerFileId,
          reviewerFileUrl: reviewerFileUrl,
          
          // Referencia a la carpeta editorial
          driveFolderId: submission.editorialFolderId,
          driveFolderUrl: submission.editorialFolderUrl || null,
          
          // Metadata de la copia
          sourceFileId: sourceFileId,
          copyCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          accessLevel: 'commenter',
          isExclusiveAccess: !!reviewerFileId,
          warnings: warnings.length > 0 ? warnings : null
        };

        assignmentRef = await db.collection('reviewerAssignments').add(assignmentData);
        console.log(`[${requestId}] ✅ Asignación creada: ${assignmentRef.id}`);
      } catch (assignmentError) {
        console.error(`❌ Error creando asignación:`, assignmentError.message);
        await logSystemError('assignment_creation_failed', assignmentError, invitationId);
        return;
      }

      // ===== PASO 8: AUDIT LOG =====
      try {
        await db.collection('submissions')
          .doc(afterData.submissionId)
          .collection('auditLogs')
          .add({
            action: 'reviewer_copy_created',
            by: 'system',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: {
              invitationId,
              reviewerEmail: afterData.reviewerEmail,
              reviewerUid: afterData.reviewerUid,
              reviewerFileId: reviewerFileId,
              reviewerFileUrl: reviewerFileUrl,
              permissions: reviewerFileId ? 'commenter_exclusive' : 'failed',
              sourceFileId: sourceFileId,
              isFormatted: !!submission.formattedDocsFile?.id,
              warnings: warnings
            }
          });
      } catch (auditError) {
        console.warn(`[${requestId}] ⚠️ Error en audit log (no crítico):`, auditError.message);
      }

      console.log(`[${requestId}] ✅ Proceso completado${warnings.length > 0 ? ` con ${warnings.length} warnings` : ''}.`);
      
      // Devolver resultado para posibles consumidores
      return {
        success: true,
        assignmentId: assignmentRef?.id,
        reviewerFileId,
        warnings
      };

    } catch (error) {
      console.error(`❌ Error fatal en onReviewerInvitationUpdated:`, error.message);
      console.error(`❌ Stack:`, error.stack);
      
      await logSystemError('fatal_error', error, invitationId);
      
      // No relanzar el error para evitar reintentos innecesarios
      return {
        success: false,
        error: error.message
      };
    }
  }
);

// ============================================================
// FUNCIÓN AUXILIAR: Configurar permisos del revisor (NO BLOQUEANTE)
// ============================================================
// ============================================================
// FUNCIÓN AUXILIAR: Configurar permisos del revisor (CORREGIDA)
// ============================================================
async function configureReviewerPermissions(drive, fileId, reviewerEmail, requestId) {
  try {
    console.log(`[${requestId}] 🔑 Iniciando configuración de permisos...`);
    
    // PASO 1: Obtener permisos existentes (SIN el campo 'inherited')
    let existingPermissions;
    try {
      const response = await drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id, emailAddress, role, type)'  // ← QUITAR 'inherited'
      });
      existingPermissions = response.data.permissions || [];
      console.log(`[${requestId}] 📋 ${existingPermissions.length} permisos encontrados`);
    } catch (listError) {
      console.warn(`[${requestId}] ⚠️ No se pudieron listar permisos:`, listError.message);
      existingPermissions = []; // Continuar sin permisos existentes
    }
    
    // PASO 2: Eliminar permisos existentes (excepto owner)
    let deletedCount = 0;
    for (const perm of existingPermissions) {
      // Saltar al propietario
      if (perm.role === 'owner') {
        console.log(`[${requestId}] 👑 Owner mantenido: ${perm.emailAddress || 'cuenta de servicio'}`);
        continue;
      }
      
      try {
        await drive.permissions.delete({
          fileId: fileId,
          permissionId: perm.id
        });
        deletedCount++;
        console.log(`[${requestId}] 🗑️ Permiso eliminado: ${perm.emailAddress || perm.id}`);
      } catch (deleteErr) {
        // Si no se puede eliminar (heredado), intentar degradar
        console.warn(`[${requestId}] ⚠️ No se pudo eliminar (posiblemente heredado): ${perm.emailAddress || perm.id}`);
        
        try {
          // Construir objeto LIMPIO sin inherited
          const cleanPerm = {
            role: 'commenter' // Degradar a comentarista
          };
          
          await drive.permissions.update({
            fileId: fileId,
            permissionId: perm.id,
            requestBody: cleanPerm  // ← OBJETO LIMPIO
          });
          console.log(`[${requestId}] ⬇️ Permiso degradado: ${perm.emailAddress || perm.id}`);
        } catch (updateErr) {
          // Ignorar si no se puede modificar
          console.warn(`[${requestId}] ⚠️ No modificable: ${perm.emailAddress || perm.id}`);
        }
      }
    }
    console.log(`[${requestId}] 🗑️ ${deletedCount} permisos eliminados`);
    
    // PASO 3: Otorgar permiso al revisor (CON OBJETO LIMPIO)
    try {
      // Construir objeto de permiso NUEVO y LIMPIO
      const reviewerPermission = {
        role: 'commenter',
        type: 'user',
        emailAddress: reviewerEmail
        // NO incluir: inherited, id, kind, etc.
      };
      
      const newPerm = await drive.permissions.create({
        fileId: fileId,
        requestBody: reviewerPermission,  // ← OBJETO LIMPIO
        sendNotificationEmail: false,
        fields: 'id'  // Solo pedir el ID
      });
      
      console.log(`[${requestId}] ✅ Permiso COMENTARISTA otorgado a: ${reviewerEmail} (ID: ${newPerm.data.id})`);
      
    } catch (createError) {
      console.error(`[${requestId}] ❌ Error otorgando permiso:`, createError.message);
      
      // Plan B: Intentar con writer y luego degradar
      try {
        const writerPerm = {
          role: 'writer',
          type: 'user',
          emailAddress: reviewerEmail
        };
        
        const tempPerm = await drive.permissions.create({
          fileId: fileId,
          requestBody: writerPerm,
          sendNotificationEmail: false,
          fields: 'id'
        });
        
        // Inmediatamente degradar a commenter
        const degradeBody = {
          role: 'commenter'
        };
        
        await drive.permissions.update({
          fileId: fileId,
          permissionId: tempPerm.data.id,
          requestBody: degradeBody  // ← OBJETO LIMPIO
        });
        
        console.log(`[${requestId}] ✅ Permiso creado y degradado a COMENTARISTA`);
      } catch (planBErr) {
        console.error(`[${requestId}] ❌ Plan B falló:`, planBErr.message);
        throw new Error(`No se pudo otorgar permiso: ${planBErr.message}`);
      }
    }
    
    // PASO 4: Verificación final (SIN inherited)
    try {
      const finalCheck = await drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id, emailAddress, role)'  // ← SIN inherited
      });
      
      const reviewerPerm = finalCheck.data.permissions.find(
        p => p.emailAddress === reviewerEmail
      );
      
      if (reviewerPerm) {
        console.log(`[${requestId}] ✅ Verificación exitosa: ${reviewerEmail} tiene rol '${reviewerPerm.role}'`);
      } else {
        console.warn(`[${requestId}] ⚠️ No se encontró permiso para ${reviewerEmail}`);
      }
    } catch (verifyError) {
      console.warn(`[${requestId}] ⚠️ Error en verificación (no crítico):`, verifyError.message);
    }
    
    return { success: true };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fatal en permisos:`, error.message);
    // No relanzar para no interrumpir el flujo principal
    return { success: false, error: error.message };
  }
}

// ============================================================
// FUNCIÓN AUXILIAR: Registrar errores del sistema
// ============================================================
async function logSystemError(errorType, error, invitationId) {
  try {
    await admin.firestore().collection('systemErrors').add({
      function: 'onReviewerInvitationUpdated',
      errorType: errorType,
      error: {
        message: error.message || 'Unknown error',
        stack: error.stack?.substring(0, 500) || 'No stack available',
        code: error.code || 'UNKNOWN'
      },
      invitationId: invitationId || 'unknown',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (logError) {
    console.error(`❌ Error al registrar error del sistema:`, logError.message);
  }
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
       <p>En los próximos días recibirá las instrucciones para los pasos finales para la publicación.</p>`
    : `<p>We are pleased to inform you that your manuscript <strong>"${articleTitle}"</strong> has been <strong>ACCEPTED</strong> for publication in The National Review of Sciences for Students!</p>
       ${feedback ? `<p><strong>Final editor's comments:</strong> ${feedback}</p>` : ''}
       <p>In the coming days you will receive instructions for the final steps for publication.</p>`;

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
      
      // ✅ CANCELAR el deadline de respuesta pendiente (ya respondió)
      const responseDeadlines = await db.collection('deadlines')
        .where('type', '==', 'reviewer-response')
        .where('targetId', '==', invitationId)
        .where('status', 'in', ['pending', 'reminded'])
        .get();
      
      if (!responseDeadlines.empty) {
        await responseDeadlines.docs[0].ref.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedNote: 'Invitación aceptada'
        });
        console.log(`✅ Deadline de respuesta completado para ${invitationId}`);
      }
      
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
 * 3. TRIGGER: Cuando se RECHAZA una reviewerInvitation, cancelar el deadline
 */
exports.onReviewerInvitationRejectedDeadline = onDocumentUpdated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invitationId = event.params.invitationId;

    // Cuando pasa a 'declined' o 'failed'
    if (beforeData.status === 'pending' && 
        (afterData.status === 'declined' || afterData.status === 'failed')) {
      
      console.log(`⏰ [onReviewerInvitationRejectedDeadline] Cancelando deadlines para ${invitationId}`);
      
      try {
        const db = admin.firestore();
        
        // Cancelar cualquier deadline pendiente para esta invitación
        const pendingDeadlines = await db.collection('deadlines')
          .where('invitationId', '==', invitationId)
          .where('status', 'in', ['pending', 'reminded'])
          .get();
        
        const batch = db.batch();
        
        pendingDeadlines.forEach(doc => {
          batch.update(doc.ref, {
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelledNote: `Invitación ${afterData.status}`
          });
        });
        
        if (!pendingDeadlines.empty) {
          await batch.commit();
          console.log(`✅ ${pendingDeadlines.size} deadlines cancelados para ${invitationId}`);
        }
        
      } catch (error) {
        console.error(`❌ Error cancelando deadlines:`, error.message);
      }
    }
  }
);

/**
 * 4. TRIGGER: Cuando se crea una reviewerAssignment, actualizar el deadline pendiente
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
          targetId: assignmentId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
 * 5. TRIGGER: Cuando se SUBE una revisión, completar el deadline
 */
exports.onReviewSubmittedCompleteDeadline = onDocumentUpdated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const assignmentId = event.params.assignmentId;

    // Cuando la revisión es enviada (pasa a 'submitted')
    if (beforeData.status !== 'submitted' && afterData.status === 'submitted') {
      
      console.log(`⏰ [onReviewSubmittedCompleteDeadline] Completando deadline para ${assignmentId}`);
      
      try {
        const db = admin.firestore();
        
        // Completar el deadline de revisión
        const pendingDeadlines = await db.collection('deadlines')
          .where('targetId', '==', assignmentId)
          .where('type', '==', 'review-submission')
          .where('status', 'in', ['pending', 'reminded'])
          .get();
        
        if (!pendingDeadlines.empty) {
          await pendingDeadlines.docs[0].ref.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedNote: 'Revisión enviada'
          });
          console.log(`✅ Deadline completado para assignment ${assignmentId}`);
        }
        
      } catch (error) {
        console.error(`❌ Error completando deadline:`, error.message);
      }
    }
  }
);

/**
 * 6. FUNCIÓN PROGRAMADA: Verificar deadlines cada hora y enviar recordatorios
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
      
      // ✅ VERIFICAR que el target aún esté activo antes de enviar recordatorio
      const isStillActive = await verifyTargetIsActive(deadline, db);
      
      if (!isStillActive) {
        console.log(`⚠️ Deadline ${doc.id} ya no está activo, cancelando...`);
        await doc.ref.update({
          status: 'cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledNote: 'Target ya no está activo'
        });
        continue;
      }
      
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
      await handleExpiredDeadline(deadline, db);
    }
    
    console.log('✅ [checkDeadlines] Verificación completada');
    
  } catch (error) {
    console.error('❌ Error en checkDeadlines:', error.message);
    await logSystemError('checkDeadlines', error);
  }
});

/**
 * 7. FUNCIÓN AUXILIAR MEJORADA: Verificar si el target sigue activo
 * Esta función previene enviar recordatorios o marcar como expirado
 * algo que ya fue respondido/entregado
 */
async function verifyTargetIsActive(deadline, db) {
  const { type, targetType, targetId } = deadline;
  
  try {
    if (type === 'reviewer-response' && targetType === 'reviewerInvitation') {
      // Verificar si la invitación ya fue respondida
      const invitationDoc = await db.collection('reviewerInvitations')
        .doc(targetId)
        .get();
      
      if (!invitationDoc.exists) {
        console.log(`⚠️ Invitación ${targetId} no existe`);
        return false;
      }
      
      const invitation = invitationDoc.data();
      
      // ✅ Si ya respondió (accepted, declined), falló, o expiró por otro lado
      if (invitation.respondedAt || invitation.failedAt) {
        console.log(`✅ Invitación ${targetId} ya respondió o falló, deadline completado`);
        return false;
      }
      
      // Si el status no es 'pending' o 'sent', ya fue procesada
      if (!['pending', 'sent'].includes(invitation.status)) {
        console.log(`⚠️ Invitación ${targetId} ya no está pendiente (status: ${invitation.status})`);
        return false;
      }
      
      return true;
      
    } else if (type === 'review-submission' && targetType === 'reviewerAssignment') {
      // Si el targetId es 'pending', el assignment aún no se ha creado
      if (targetId === 'pending') {
        // Verificar si la invitación asociada sigue activa
        if (deadline.invitationId) {
          const invitationDoc = await db.collection('reviewerInvitations')
            .doc(deadline.invitationId)
            .get();
          
          if (invitationDoc.exists) {
            const invitation = invitationDoc.data();
            // Si la invitación fue rechazada o expiró, cancelar este deadline
            if (['declined', 'expired', 'failed'].includes(invitation.status)) {
              console.log(`⚠️ Invitación ${deadline.invitationId} ya no está activa`);
              return false;
            }
          }
        }
        return true; // Aún no hay assignment, seguimos esperando
      }
      
      // Verificar si el assignment ya fue entregado
      const assignmentDoc = await db.collection('reviewerAssignments')
        .doc(targetId)
        .get();
      
      if (!assignmentDoc.exists) {
        console.log(`⚠️ Assignment ${targetId} no existe`);
        return false;
      }
      
      const assignment = assignmentDoc.data();
      
      // ✅ Si ya envió la revisión
      if (assignment.submittedAt || assignment.status === 'submitted') {
        console.log(`✅ Assignment ${targetId} ya fue entregado, deadline completado`);
        return false;
      }
      
      // Si el revisor rechazó o fue cancelado
      if (['declined', 'cancelled', 'withdrawn'].includes(assignment.status)) {
        console.log(`⚠️ Assignment ${targetId} ya no está activo (status: ${assignment.status})`);
        return false;
      }
      
      return true;
    }
    
    return true; // Por defecto, asumir activo
    
  } catch (error) {
    console.error(`❌ Error verificando target:`, error.message);
    return true; // En caso de error, no cancelar (mejor falso positivo que falso negativo)
  }
}

/**
 * 8. FUNCIÓN AUXILIAR MEJORADA: Manejar deadline vencido
 * Ahora verifica si el target ya fue respondido antes de marcar como expirado/overdue
 */
async function handleExpiredDeadline(deadline, db) {
  const { type, targetType, targetId, reviewerEmail, reviewerName } = deadline;
  
  try {
    // ✅ VERIFICACIÓN PREVIA: No marcar como expirado si ya respondió
    const isStillActive = await verifyTargetIsActive(deadline, db);
    
    if (!isStillActive) {
      console.log(`✅ Deadline ${type} para ${targetId} ya fue respondido, no se marca como expirado`);
      
      // Actualizar el deadline como completado/cancelado en lugar de missed
      await db.collection('deadlines').doc(deadline.id || '').update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedNote: 'Ya fue respondido antes de expirar',
        _wasActive: false
      }).catch(err => console.error('Error actualizando deadline:', err));
      
      return;
    }
    
    // Si llegamos aquí, el target realmente expiró sin respuesta
    if (type === 'reviewer-response' && targetType === 'reviewerInvitation') {
      
      // ✅ VERIFICACIÓN FINAL: Leer el estado actual de la invitación
      const invitationDoc = await db.collection('reviewerInvitations')
        .doc(targetId)
        .get();
      
      if (invitationDoc.exists) {
        const invitation = invitationDoc.data();
        
        // ⚠️ DOBLE VERIFICACIÓN: Si ya respondió, no marcar como expirada
        if (invitation.respondedAt || invitation.failedAt) {
          console.log(`⚠️ Invitación ${targetId} ya respondió, no se marca como expirada`);
          return;
        }
        
        // Si ya tiene un status final, no cambiar
        if (['accepted', 'declined', 'failed', 'cancelled'].includes(invitation.status)) {
          console.log(`⚠️ Invitación ${targetId} ya tiene status ${invitation.status}, no se modifica`);
          return;
        }
        
        // ✅ Solo marcar como expirada si realmente está pendiente
        await invitationDoc.ref.update({
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          expiredByDeadline: true,
          deadlineId: deadline.id || null
        });
        
        console.log(`⚠️ Invitación ${targetId} expirada para ${reviewerEmail}`);
        
        // Notificar al editor
        await notifyEditorAboutExpiredInvitation(deadline, db);
      }
      
    } else if (type === 'review-submission' && targetType === 'reviewerAssignment') {
      
      if (!targetId || targetId === 'pending') {
        console.log(`⚠️ Deadline de revisión sin assignment creado para invitación ${deadline.invitationId}`);
        return;
      }
      
      // ✅ VERIFICACIÓN FINAL: Leer el estado actual del assignment
      const assignmentDoc = await db.collection('reviewerAssignments')
        .doc(targetId)
        .get();
      
      if (assignmentDoc.exists) {
        const assignment = assignmentDoc.data();
        
        // ⚠️ DOBLE VERIFICACIÓN: Si ya envió la revisión, no marcar como overdue
        if (assignment.submittedAt || assignment.status === 'submitted') {
          console.log(`⚠️ Assignment ${targetId} ya fue entregado, no se marca como overdue`);
          
          // Actualizar el deadline como completado
          await db.collection('deadlines').doc(deadline.id || '').update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedNote: 'Revisión entregada (verificación tardía)'
          }).catch(() => {});
          
          return;
        }
        
        // Si ya tiene un status final, no cambiar
        if (['submitted', 'declined', 'cancelled', 'withdrawn'].includes(assignment.status)) {
          console.log(`⚠️ Assignment ${targetId} ya tiene status ${assignment.status}, no se modifica`);
          return;
        }
        
        // ✅ Solo marcar como overdue si realmente está pendiente
        await assignmentDoc.ref.update({
          status: 'overdue',
          overdueAt: admin.firestore.FieldValue.serverTimestamp(),
          overdueByDeadline: true,
          deadlineId: deadline.id || null
        });
        
        console.log(`⚠️ Asignación ${targetId} vencida para ${reviewerEmail}`);
        
        // Notificar al editor
        await notifyEditorAboutOverdueAssignment(deadline, db);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error manejando deadline vencido:`, error.message);
  }
}

/**
 * 9. FUNCIÓN AUXILIAR: Enviar recordatorio por email
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
 * 10. FUNCIÓN AUXILIAR: Notificar al editor sobre invitación expirada
 */
async function notifyEditorAboutExpiredInvitation(deadline, db) {
  try {
    if (!deadline.editorialTaskId) return;
    
    // Obtener el editorialTask para encontrar al editor asignado
    const taskDoc = await db.collection('editorialTasks')
      .doc(deadline.editorialTaskId)
      .get();
    
    if (!taskDoc.exists) return;
    
    const task = taskDoc.data();
    const editorEmail = task.assignedToEmail;
    
    if (!editorEmail) return;
    
    // Crear notificación en el sistema
    await db.collection('notifications').add({
      type: 'reviewer_invitation_expired',
      title: 'Invitación de revisión expirada',
      message: `La invitación enviada a ${deadline.reviewerName || deadline.reviewerEmail} ha expirado sin respuesta.`,
      forUid: task.assignedTo,
      data: {
        invitationId: deadline.targetId,
        submissionId: deadline.submissionId,
        reviewerEmail: deadline.reviewerEmail
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error notificando al editor:', error.message);
  }
}

/**
 * 11. FUNCIÓN AUXILIAR: Notificar al editor sobre revisión overdue
 */
async function notifyEditorAboutOverdueAssignment(deadline, db) {
  try {
    if (!deadline.editorialTaskId) return;
    
    const taskDoc = await db.collection('editorialTasks')
      .doc(deadline.editorialTaskId)
      .get();
    
    if (!taskDoc.exists) return;
    
    const task = taskDoc.data();
    const editorEmail = task.assignedToEmail;
    
    if (!editorEmail) return;
    
    await db.collection('notifications').add({
      type: 'review_overdue',
      title: 'Revisión atrasada',
      message: `La revisión de ${deadline.reviewerName || deadline.reviewerEmail} está atrasada.`,
      forUid: task.assignedTo,
      data: {
        assignmentId: deadline.targetId,
        submissionId: deadline.submissionId,
        reviewerEmail: deadline.reviewerEmail
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error notificando al editor:', error.message);
  }
}


/* ===================== CORRECCIÓN DE onEditorialReviewUpdated ===================== */

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
      const lang = submissionData.paperLanguage || 'es';
      const authorName = submissionData.authorName || 'Autor';
      const currentRound = submissionData.currentRound || 1;

      // Determinar si es decisión final o desk review
      const isFinalDecision = ['accept', 'reject'].includes(afterData.decision);
      
      // Preparar datos para actualizar submission
      const submissionUpdateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Preparar datos para actualizar tarea
      const taskUpdateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      let emailHtml = '';
      let newTaskStatus = '';

      if (isFinalDecision) {
        // ===== DECISIÓN FINAL: Guardar en campos separados =====
        console.log(`🎯 Decisión FINAL detectada: ${afterData.decision}`);
        
        submissionUpdateData.finalDecision = afterData.decision;
        submissionUpdateData.finalFeedback = afterData.feedbackToAuthor || '';
        submissionUpdateData.finalCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        submissionUpdateData.finalDecisionRound = currentRound;
        submissionUpdateData.decisionMadeAt = admin.firestore.FieldValue.serverTimestamp();
        submissionUpdateData.decisionMadeBy = afterData.editorUid || null;
        
        // Estado del submission según decisión final
        submissionUpdateData.status = afterData.decision === 'accept' ? 'accepted' : 'rejected';
        
        // Datos para la tarea
        taskUpdateData.finalDecision = afterData.decision;
        taskUpdateData.finalFeedbackToAuthor = afterData.feedbackToAuthor || '';
        taskUpdateData.finalComments = afterData.commentsToEditorial || '';
        taskUpdateData.finalCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        newTaskStatus = 'completed';
        
        // Email según decisión final
        emailHtml = afterData.decision === 'accept' 
          ? getAcceptanceEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName)
          : getRejectionEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName);
          
      } else {
        // ===== DESK REVIEW: Guardar en campos de desk review =====
        console.log(`📋 Desk Review detectada: ${afterData.decision}`);
        
        submissionUpdateData.deskReviewDecision = afterData.decision;
        submissionUpdateData.deskReviewFeedback = afterData.feedbackToAuthor || '';
        submissionUpdateData.deskReviewCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        submissionUpdateData.deskReviewRound = currentRound;
        
        // Estado del submission según desk review
        if (afterData.decision === 'revision-required') {
          submissionUpdateData.status = 'in-reviewer-selection';
          newTaskStatus = 'reviewer-selection';
          emailHtml = getPeerReviewStartEmailBody(submissionData.title, lang, authorName);
        } else if (['minor-revision', 'major-revision'].includes(afterData.decision)) {
          submissionUpdateData.status = 'revisions-requested';
          newTaskStatus = 'awaiting-author-revision';
          const revisionType = afterData.decision === 'minor-revision' ? 'minor' : 'major';
          emailHtml = getRevisionEmailBody(
            afterData.feedbackToAuthor, 
            submissionData.title, 
            revisionType, 
            lang, 
            authorName
          );
        } else {
          submissionUpdateData.status = 'in-editorial-review';
          newTaskStatus = 'desk-review-in-progress';
        }
        
        // Datos para la tarea
        taskUpdateData.deskReviewDecision = afterData.decision;
        taskUpdateData.deskReviewFeedback = afterData.feedbackToAuthor || '';
        taskUpdateData.deskReviewComments = afterData.commentsToEditorial || '';
        taskUpdateData.deskReviewCompletedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      // Actualizar submission con los campos correspondientes
      await submissionRef.update(submissionUpdateData);
      console.log(`✅ Submission ${afterData.submissionId} actualizado con ${isFinalDecision ? 'decisión final' : 'desk review'}`);

      // Actualizar la tarea editorial si existe
      if (afterData.editorialTaskId) {
        const taskRef = db.collection('editorialTasks').doc(afterData.editorialTaskId);
        
        taskUpdateData.status = newTaskStatus;
        await taskRef.update(taskUpdateData);
        console.log(`✅ Tarea editorial ${afterData.editorialTaskId} actualizada a estado: ${newTaskStatus}`);
      }

      // Guardar en el historial de rondas del submission
      const roundHistoryRef = submissionRef.collection('roundHistory').doc(`round_${currentRound}`);
      const roundHistoryData = {
        round: currentRound,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (isFinalDecision) {
        roundHistoryData.finalDecision = afterData.decision;
        roundHistoryData.finalFeedback = afterData.feedbackToAuthor || '';
        roundHistoryData.finalCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        roundHistoryData.finalEditor = afterData.editorUid || null;
      } else {
        roundHistoryData.deskReviewDecision = afterData.decision;
        roundHistoryData.deskReviewFeedback = afterData.feedbackToAuthor || '';
        roundHistoryData.deskReviewComments = afterData.commentsToEditorial || '';
        roundHistoryData.deskReviewCompletedAt = admin.firestore.FieldValue.serverTimestamp();
        roundHistoryData.deskReviewEditor = afterData.editorUid || null;
      }
      
      await roundHistoryRef.set(roundHistoryData, { merge: true });
      console.log(`✅ Historial de ronda ${currentRound} actualizado`);

      // Enviar email al autor
      if (emailHtml && submissionData.authorEmail) {
        const emailSubject = lang === 'es' ? 'Actualización sobre su envío' : 'Update on your submission';
        await sendEmailViaExtension(submissionData.authorEmail, emailSubject, emailHtml);
        console.log(`✅ Email enviado a autor: ${submissionData.authorEmail}`);
      }

      console.log(`✅ Proceso completado para ${afterData.submissionId}`);

    } catch (error) {
      console.error(`❌ [onEditorialReviewUpdated] Error:`, error.message);
      console.error(error.stack);
      await logSystemError('onEditorialReviewUpdated', error, { 
        reviewId, 
        submissionId: afterData.submissionId,
        decision: afterData.decision 
      });
    }
  }
);
exports.onReviewerAssignmentCreatedEmail = onDocumentCreated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const assignment = event.data.data();
    const assignmentId = event.params.assignmentId;

    console.log(`📧 [REVIEWER EMAIL] Enviando instrucciones para asignación ${assignmentId}`);

    try {
      const db = admin.firestore();
      
      // ===== PASO 1: Obtener datos del submission =====
      const submissionDoc = await db.collection('submissions').doc(assignment.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ Submission no encontrado: ${assignment.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();
      
      // ===== PASO 2: VALIDACIÓN RIGUROSA - EL DOCUMENTO DEL REVISOR ES OBLIGATORIO =====
      if (!assignment.reviewerFileUrl || !assignment.reviewerFileId) {
        console.error(`❌ [REVIEWER EMAIL] Asignación ${assignmentId} SIN documento de revisor. ABORTANDO.`);
        
        // Registrar error crítico
        await db.collection('systemErrors').add({
          function: 'onReviewerAssignmentCreatedEmail',
          error: {
            message: 'Asignación sin reviewerFileUrl/reviewerFileId',
            severity: 'CRITICAL'
          },
          assignmentId,
          reviewerEmail: assignment.reviewerEmail,
          submissionId: assignment.submissionId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Notificar al editor sobre el problema
        try {
          const editorSnapshot = await db.collection('users')
            .where('roles', 'array-contains', 'Editor en Jefe')
            .limit(1)
            .get();
          
          if (!editorSnapshot.empty) {
            const editorEmail = editorSnapshot.docs[0].data().email;
            await sendEmailViaExtension(
              editorEmail,
              '⚠️ ALERTA: Revisor sin documento asignado',
              getEmailTemplate(
                'Alerta del Sistema',
                'Estimado Editor,',
                `<p>La asignación de revisión <strong>${assignmentId}</strong> para el revisor <strong>${assignment.reviewerEmail}</strong> no tiene un documento de revisión asignado.</p>
                 <p><strong>Submission:</strong> ${submission.title || assignment.submissionId}</p>
                 <p><strong>Acción requerida:</strong> Verificar el trigger onReviewerInvitationUpdated y asignar manualmente el documento.</p>`,
                'Sistema Automático',
                'Revista Nacional de las Ciencias para Estudiantes',
                'es'
              )
            );
          }
        } catch (notifyErr) {
          console.error(`❌ Error notificando al editor:`, notifyErr.message);
        }
        
        return; // ABORTAR - No enviar email sin documento
      }
      
      console.log(`[REVIEWER EMAIL] ✅ Documento del revisor verificado: ${assignment.reviewerFileId}`);
      console.log(`[REVIEWER EMAIL] 🔗 URL: ${assignment.reviewerFileUrl}`);
      
      // ===== PASO 3: Configurar idioma =====
      const lang = submission.paperLanguage || 'es';
      const isSpanish = lang === 'es';
      const baseUrl = 'https://www.revistacienciasestudiantes.com';
      
      // ===== PASO 4: Construir email =====
      const emailTitle = isSpanish 
        ? '📝 Instrucciones para tu revisión - Acceso al manuscrito' 
        : '📝 Instructions for your review - Manuscript access';
      
      const emailGreeting = isSpanish 
        ? `Estimado/a ${assignment.reviewerName || 'Revisor'}:` 
        : `Dear ${assignment.reviewerName || 'Reviewer'}:`;
      
      // Calcular fecha límite
      const dueDate = assignment.dueDate?.toDate() || new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      const formattedDate = dueDate.toLocaleDateString(isSpanish ? 'es-CL' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const bodyContent = isSpanish
    ? `
      <p>Gracias por aceptar la invitación a revisar el siguiente artículo:</p>
      
      <div class="highlight-box">
        <p class="article-title">📚 "${submission.title}"</p>
        <p style="font-size: 13px; color: #666; margin-top: 8px;">
          <strong>ID de submission:</strong> ${submission.submissionId || 'N/A'}<br>
          <strong>Tipo de artículo:</strong> ${(submission.articleType || 'Research Article').toUpperCase()}<br>
          <strong>Ronda de revisión:</strong> ${assignment.round || 1}<br>
          <strong>Fecha límite:</strong> ${formattedDate}
        </p>
      </div>
      
      <div class="info-box" style="background: #f0f7ff; border-left: 4px solid #00509e; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #00509e;">🔍 ACCESO AL MANUSCRITO</h3>
        <p>Ya tienes acceso <strong>exclusivo</strong> a tu copia del manuscrito. <strong>Solo tú</strong> puedes ver y comentar en este documento.</p>
        <p style="margin-bottom: 0;"><strong>⚠️ Importante:</strong> Este es un documento de solo comentarios. <u>No puedes editar el texto</u>, solo añadir comentarios y sugerencias.</p>
      </div>
      
      <div class="button-container" style="margin: 25px 0;">
        <a href="${assignment.reviewerFileUrl}" class="btn" style="font-size: 16px; padding: 14px 28px;">
          📄 ABRIR MANUSCRITO PARA REVISIÓN
        </a>
      </div>
      
      <div class="instructions-box" style="background: #fafafa; border: 1px solid #e0e0e0; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #333;">📋 CÓMO DEJAR TUS COMENTARIOS</h3>
        <ol style="padding-left: 20px; line-height: 1.8;">
          <li><strong>Abre el documento</strong> usando el botón de arriba</li>
          <li><strong>Selecciona el texto</strong> que quieras comentar</li>
          <li><strong>Añade un comentario:</strong>
            <ul style="margin-top: 5px;">
              <li>En computadora: <strong>Ctrl + Alt + M</strong> (Windows/Linux) o <strong>⌘ + Option + M</strong> (Mac)</li>
              <li>O haz clic en <strong>Insertar → Comentario</strong> en el menú</li>
              <li>O usa el botón <strong>+</strong> que aparece al seleccionar texto</li>
            </ul>
          </li>
          <li><strong>Escribe tu observación</strong> de forma clara y constructiva</li>
          <li><strong>Haz clic en "Comentar"</strong> para guardar</li>
        </ol>
        
        <h4 style="color: #555; margin-top: 20px;">💡 Consejos para tus comentarios:</h4>
        <ul style="padding-left: 20px; line-height: 1.8;">
          <li>Sé <strong>específico</strong>: indica exactamente qué parte necesita revisión</li>
          <li>Sé <strong>constructivo</strong>: sugiere mejoras, no solo señales problemas</li>
          <li>Sé <strong>respetuoso</strong>: mantén un tono profesional y académico</li>
          <li><strong>Céntrate en:</strong> metodología, análisis de datos, conclusiones y referencias</li>
          <li>Los comentarios son <strong>anónimos</strong>: los autores no verán tu identidad</li>
        </ul>
      </div>
      
      <p><strong>Después de revisar el documento, envía tu informe completo a través del portal:</strong></p>
      
      <div class="button-container" style="margin: 20px 0;">
        <a href="${baseUrl}/reviewer-workspace/${assignmentId}" class="btn btn-secondary" style="font-size: 15px; padding: 12px 24px;">
          📤 ENVIAR INFORME DE REVISIÓN
        </a>
      </div>
      
      <div class="warning-box" style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404;">
          <strong>⏰ Recordatorio:</strong> La fecha límite para completar tu revisión es el <strong>${formattedDate}</strong>.
          Por favor, organiza tu tiempo para cumplir con este plazo.
        </p>
      </div>
      
      <p class="info-text" style="color: #666; font-size: 13px;">
        <strong>¿Problemas para acceder al documento?</strong> 
        Asegúrate de haber iniciado sesión en Google con la cuenta 
        <strong>${assignment.reviewerEmail}</strong>. Si el problema persiste, 
        <a href="mailto:contact@revistacienciasestudiantes.com">contáctanos</a>.
      </p>
    `
    : `
      <p>Thank you for accepting the invitation to review the following article:</p>
      
      <div class="highlight-box">
        <p class="article-title">📚 "${submission.title}"</p>
        <p style="font-size: 13px; color: #666; margin-top: 8px;">
          <strong>Submission ID:</strong> ${submission.submissionId || 'N/A'}<br>
          <strong>Article Type:</strong> ${(submission.articleType || 'Research Article').toUpperCase()}<br>
          <strong>Review Round:</strong> ${assignment.round || 1}<br>
          <strong>Deadline:</strong> ${formattedDate}
        </p>
      </div>
      
      <div class="info-box" style="background: #f0f7ff; border-left: 4px solid #00509e; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #00509e;">🔍 MANUSCRIPT ACCESS</h3>
        <p>You now have <strong>exclusive access</strong> to your copy of the manuscript. <strong>Only you</strong> can view and comment on this document.</p>
        <p style="margin-bottom: 0;"><strong>⚠️ Important:</strong> This is a comment-only document. <u>You cannot edit the text</u>, only add comments and suggestions.</p>
      </div>
      
      <div class="button-container" style="margin: 25px 0;">
        <a href="${assignment.reviewerFileUrl}" class="btn" style="font-size: 16px; padding: 14px 28px;">
          📄 OPEN MANUSCRIPT FOR REVIEW
        </a>
      </div>
      
      <div class="instructions-box" style="background: #fafafa; border: 1px solid #e0e0e0; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #333;">📋 HOW TO LEAVE COMMENTS</h3>
        <ol style="padding-left: 20px; line-height: 1.8;">
          <li><strong>Open the document</strong> using the button above</li>
          <li><strong>Select the text</strong> you want to comment on</li>
          <li><strong>Add a comment:</strong>
            <ul style="margin-top: 5px;">
              <li>On desktop: <strong>Ctrl + Alt + M</strong> (Windows/Linux) or <strong>⌘ + Option + M</strong> (Mac)</li>
              <li>Or click <strong>Insert → Comment</strong> in the menu</li>
              <li>Or use the <strong>+</strong> button that appears when selecting text</li>
            </ul>
          </li>
          <li><strong>Write your observation</strong> clearly and constructively</li>
          <li><strong>Click "Comment"</strong> to save</li>
        </ol>
        
        <h4 style="color: #555; margin-top: 20px;">💡 Tips for your comments:</h4>
        <ul style="padding-left: 20px; line-height: 1.8;">
          <li>Be <strong>specific</strong>: indicate exactly what needs revision</li>
          <li>Be <strong>constructive</strong>: suggest improvements, not just problems</li>
          <li>Be <strong>respectful</strong>: maintain a professional and academic tone</li>
          <li><strong>Focus on:</strong> methodology, data analysis, conclusions, and references</li>
          <li>Comments are <strong>anonymous</strong>: authors will not see your identity</li>
        </ul>
      </div>
      
      <p><strong>After reviewing the document, submit your complete report through the portal:</strong></p>
      
      <div class="button-container" style="margin: 20px 0;">
        <a href="${baseUrl}/reviewer-workspace/${assignmentId}" class="btn btn-secondary" style="font-size: 15px; padding: 12px 24px;">
          📤 SUBMIT REVIEW REPORT
        </a>
      </div>
      
      <div class="warning-box" style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404;">
          <strong>⏰ Reminder:</strong> The deadline to complete your review is <strong>${formattedDate}</strong>.
          Please plan your time accordingly.
        </p>
      </div>
      
      <p class="info-text" style="color: #666; font-size: 13px;">
        <strong>Problems accessing the document?</strong> 
        Make sure you're signed into Google with 
        <strong>${assignment.reviewerEmail}</strong>. If issues persist, 
        <a href="mailto:contact@revistacienciasestudiantes.com">contact us</a>.
      </p>
    `;

      // ===== PASO 5: Generar HTML completo con template =====
      const htmlBody = getEmailTemplate(
        emailTitle,
        emailGreeting,
        bodyContent,
        isSpanish ? 'Equipo Editorial' : 'Editorial Team',
        isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
        lang
      );

      // ===== PASO 6: Enviar email =====
      await sendEmailViaExtension(assignment.reviewerEmail, emailTitle, htmlBody);
      
      console.log(`[REVIEWER EMAIL] ✅ Email enviado a ${assignment.reviewerEmail}`);
      console.log(`[REVIEWER EMAIL] 📄 Documento: ${assignment.reviewerFileId}`);
      console.log(`[REVIEWER EMAIL] 🔗 URL: ${assignment.reviewerFileUrl}`);

      // ===== PASO 7: Registrar envío en Firestore =====
      await db.collection('reviewerAssignments').doc(assignmentId).update({
        instructionsEmailSent: true,
        instructionsEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        instructionsEmailRecipient: assignment.reviewerEmail,
        documentUrlSent: assignment.reviewerFileUrl
      });

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentCreatedEmail:`, error.message);
      console.error(`❌ Stack:`, error.stack);
      
      // Registrar error
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'onReviewerAssignmentCreatedEmail',
          error: {
            message: error.message,
            stack: error.stack?.substring(0, 500)
          },
          assignmentId,
          reviewerEmail: event.data.data()?.reviewerEmail,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error(`❌ Error al registrar error:`, logError.message);
      }
    }
  }
);
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

// ===================== NUEVO TRIGGER: CUANDO SE CREAN DOCUMENTOS DE ASIGNACIÓN Y HAY MÍNIMO DOS =====================
// REEMPLAZA la función 'onReviewerAssignmentStatusChanged' o 'onReviewerAssignmentAccepted' con esta.

// ===================== VERSIÓN CORREGIDA - TRIGGER AL CREAR ASSIGNMENT =====================
exports.onReviewerAssignmentCreated = onDocumentCreated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const newAssignment = event.data.data();
    const newAssignmentId = event.params.assignmentId;

    console.log(`🆕 [REVIEWER MILESTONE] Nueva asignación creada: ${newAssignmentId}`);
    console.log(`👤 Revisor: ${newAssignment.reviewerName} (${newAssignment.reviewerEmail})`);

    try {
      const db = admin.firestore();
      const taskId = newAssignment.editorialTaskId;

      if (!taskId) {
        console.warn(`⚠️ Asignación ${newAssignmentId} sin editorialTaskId. No se puede verificar.`);
        return;
      }

      // ===== PASO 1: Obtener la tarea editorial =====
      const taskRef = db.collection('editorialTasks').doc(taskId);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        console.error(`❌ Tarea editorial no encontrada: ${taskId}`);
        return;
      }
      const taskData = taskSnap.data();

      // ===== PASO 2: Contar revisores aceptados =====
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .get();

      const acceptedCount = assignmentsSnapshot.size;
      const requiredReviewers = taskData.requiredReviewers || 2;
      
      console.log(`📊 Revisores aceptados: ${acceptedCount}/${requiredReviewers} requeridos`);

      // ===== PASO 3: Obtener datos del submission =====
      const submissionRef = db.collection('submissions').doc(taskData.submissionId);
      const submissionSnap = await submissionRef.get();

      if (!submissionSnap.exists) {
        console.error(`❌ Submission no encontrado: ${taskData.submissionId}`);
        return;
      }
      const submissionData = submissionSnap.data();
      const lang = submissionData.paperLanguage || 'es';
      const isSpanish = lang === 'es';

      // ===== PASO 4: Construir lista de revisores =====
      let reviewersListHtml = '<ul style="padding-left: 20px; line-height: 1.8;">';
      assignmentsSnapshot.docs.forEach(doc => {
        const reviewer = doc.data();
        reviewersListHtml += `<li><strong>${reviewer.reviewerName || 'Revisor'}</strong> — ${reviewer.reviewerEmail}</li>`;
      });
      reviewersListHtml += '</ul>';

      // ===== PASO 5: LÓGICA SEGÚN CANTIDAD DE REVISORES =====
      
      if (acceptedCount === 2) {
        // ============================================================
        // CASO 1: EXACTAMENTE 2 REVISORES - INICIAR REVISIÓN POR PARES
        // ============================================================
        console.log(`✅ MÍNIMO ALCANZADO (2/${requiredReviewers}). Iniciando revisión por pares.`);

        // Actualizar estados en transacción
        await db.runTransaction(async (transaction) => {
          const taskTxSnap = await transaction.get(taskRef);
          if (!taskTxSnap.exists) return;
          
          const currentTaskStatus = taskTxSnap.data().status;

          if (currentTaskStatus === 'reviewer-selection') {
            transaction.update(taskRef, {
              status: 'reviews-in-progress',
              acceptedReviewers: acceptedCount,
              minimumReviewersReachedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            transaction.update(submissionRef, {
              status: 'in-peer-review',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Transacción exitosa: Revisión por pares iniciada.`);
          } else {
            console.log(`⏭️ Tarea ya en estado: ${currentTaskStatus}`);
          }
        });

        // Enviar notificación ESTÁNDAR al editor
        const emailTitle = isSpanish
          ? `✅ Revisión por pares iniciada: "${submissionData.title.substring(0, 60)}${submissionData.title.length > 60 ? '...' : ''}"`
          : `✅ Peer review started: "${submissionData.title.substring(0, 60)}${submissionData.title.length > 60 ? '...' : ''}"`;

        const emailGreeting = isSpanish
          ? `Estimado/a ${taskData.assignedToName || 'Editor/a'}:`
          : `Dear ${taskData.assignedToName || 'Editor'}:`;

        const bodyContent = isSpanish
          ? `
            <p>El artículo ha alcanzado el mínimo de <strong>2 revisores aceptados</strong> y ha pasado automáticamente a la fase de <strong>revisión por pares</strong>.</p>

            <div class="highlight-box">
              <p class="article-title">📚 "${submissionData.title}"</p>
              <p><strong>ID del envío:</strong> ${submissionData.submissionId}</p>
              <p><strong>Área:</strong> ${submissionData.area || 'No especificada'}</p>
              <p><strong>Autor/a:</strong> ${submissionData.authorName || 'No especificado'}</p>
              <p><strong>Tipo de artículo:</strong> ${(submissionData.articleType || 'Research Article').toUpperCase()}</p>
            </div>

            <h3 style="color: #2d7d46;">✅ Revisores asignados (${acceptedCount}):</h3>
            ${reviewersListHtml}

            <p>El sistema notificará automáticamente cuando se completen las revisiones.</p>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/editorial/task/${taskId}" class="btn">
                📋 VER TAREA EDITORIAL
              </a>
            </div>

            <p style="color: #666; font-size: 13px; margin-top: 20px;">
              <em>Este es un mensaje automático del sistema. Los revisores ya tienen acceso a sus copias del manuscrito.</em>
            </p>
          `
          : `
            <p>The article has reached the minimum of <strong>2 accepted reviewers</strong> and has automatically moved to the <strong>peer review</strong> phase.</p>

            <div class="highlight-box">
              <p class="article-title">📚 "${submissionData.title}"</p>
              <p><strong>Submission ID:</strong> ${submissionData.submissionId}</p>
              <p><strong>Area:</strong> ${submissionData.area || 'Not specified'}</p>
              <p><strong>Author:</strong> ${submissionData.authorName || 'Not specified'}</p>
              <p><strong>Article Type:</strong> ${(submissionData.articleType || 'Research Article').toUpperCase()}</p>
            </div>

            <h3 style="color: #2d7d46;">✅ Assigned reviewers (${acceptedCount}):</h3>
            ${reviewersListHtml}

            <p>The system will automatically notify you when reviews are completed.</p>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/editorial/task/${taskId}" class="btn">
                📋 VIEW EDITORIAL TASK
              </a>
            </div>

            <p style="color: #666; font-size: 13px; margin-top: 20px;">
              <em>This is an automated system message. Reviewers already have access to their manuscript copies.</em>
            </p>
          `;

        const htmlBody = getEmailTemplate(
          emailTitle,
          emailGreeting,
          bodyContent,
          isSpanish ? 'Sistema Editorial' : 'Editorial System',
          isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
          lang
        );

        await sendEmailViaExtension(taskData.assignedToEmail, emailTitle, htmlBody);
        console.log(`✅ Notificación estándar enviada al editor: ${taskData.assignedToEmail}`);

        // Registrar en audit log
        await db.collection('submissions').doc(taskData.submissionId)
          .collection('auditLogs').add({
            action: 'peer_review_started',
            details: `Revisión por pares iniciada con ${acceptedCount} revisores.`,
            taskId: taskId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

      } else if (acceptedCount > 2) {
        // ============================================================
        // CASO 2: MÁS DE 2 REVISORES - NOTIFICACIÓN ESPECIAL
        // ============================================================
        console.log(`🔔 REVISOR EXTRA (${acceptedCount} total). Enviando notificación especial al editor.`);

        const extraReviewer = newAssignment; // El que acaba de aceptar
        const extraCount = acceptedCount - 2;

        const emailTitle = isSpanish
          ? `🔔 Revisor adicional aceptó: "${submissionData.title.substring(0, 60)}${submissionData.title.length > 60 ? '...' : ''}"`
          : `🔔 Additional reviewer accepted: "${submissionData.title.substring(0, 60)}${submissionData.title.length > 60 ? '...' : ''}"`;

        const emailGreeting = isSpanish
          ? `Estimado/a ${taskData.assignedToName || 'Editor/a'}:`
          : `Dear ${taskData.assignedToName || 'Editor'}:`;

        const bodyContent = isSpanish
          ? `
            <div class="info-box" style="background: #fff8e1; border-left: 4px solid #ff8f00; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #e65100;">🔔 REVISOR ADICIONAL</h3>
              <p>Un <strong>${acceptedCount}º revisor</strong> ha aceptado la invitación para el artículo que ya está en revisión por pares.</p>
            </div>

            <div class="highlight-box">
              <p class="article-title">📚 "${submissionData.title}"</p>
              <p><strong>ID del envío:</strong> ${submissionData.submissionId}</p>
              <p><strong>Estado actual:</strong> En revisión por pares</p>
            </div>

            <h3 style="color: #e65100;">🆕 Nuevo revisor que aceptó:</h3>
            <ul style="padding-left: 20px; line-height: 1.8;">
              <li><strong>Nombre:</strong> ${extraReviewer.reviewerName || 'No especificado'}</li>
              <li><strong>Email:</strong> ${extraReviewer.reviewerEmail}</li>
              <li><strong>Ronda:</strong> ${extraReviewer.round || 1}</li>
            </ul>

            <h3 style="color: #333;">📋 Todos los revisores asignados (${acceptedCount}):</h3>
            ${reviewersListHtml}

            <div class="warning-box" style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Atención:</strong> Hay <strong>${extraCount} revisor(es) adicional(es)</strong> además de los 2 requeridos. 
                Esto puede enriquecer la revisión pero también extender los tiempos. 
                El sistema esperará a que todos completen sus revisiones o hasta que tú decidas cerrar el proceso manualmente.
              </p>
            </div>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/editorial/task/${taskId}" class="btn">
                📋 GESTIONAR TAREA EDITORIAL
              </a>
            </div>

            <p style="color: #666; font-size: 13px; margin-top: 20px;">
              <em>Este es un mensaje automático del sistema. El revisor adicional ya tiene acceso a su copia del manuscrito.</em>
            </p>
          `
          : `
            <div class="info-box" style="background: #fff8e1; border-left: 4px solid #ff8f00; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #e65100;">🔔 ADDITIONAL REVIEWER</h3>
              <p>A <strong>${acceptedCount}th reviewer</strong> has accepted the invitation for the article already in peer review.</p>
            </div>

            <div class="highlight-box">
              <p class="article-title">📚 "${submissionData.title}"</p>
              <p><strong>Submission ID:</strong> ${submissionData.submissionId}</p>
              <p><strong>Current status:</strong> In peer review</p>
            </div>

            <h3 style="color: #e65100;">🆕 New reviewer who accepted:</h3>
            <ul style="padding-left: 20px; line-height: 1.8;">
              <li><strong>Name:</strong> ${extraReviewer.reviewerName || 'Not specified'}</li>
              <li><strong>Email:</strong> ${extraReviewer.reviewerEmail}</li>
              <li><strong>Round:</strong> ${extraReviewer.round || 1}</li>
            </ul>

            <h3 style="color: #333;">📋 All assigned reviewers (${acceptedCount}):</h3>
            ${reviewersListHtml}

            <div class="warning-box" style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404;">
                <strong>⚠️ Attention:</strong> There are <strong>${extraCount} additional reviewer(s)</strong> beyond the 2 required. 
                This may enrich the review but also extend timelines. 
                The system will wait for all to complete their reviews or until you decide to close the process manually.
              </p>
            </div>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/editorial/task/${taskId}" class="btn">
                📋 MANAGE EDITORIAL TASK
              </a>
            </div>

            <p style="color: #666; font-size: 13px; margin-top: 20px;">
              <em>This is an automated system message. The additional reviewer already has access to their manuscript copy.</em>
            </p>
          `;

        const htmlBody = getEmailTemplate(
          emailTitle,
          emailGreeting,
          bodyContent,
          isSpanish ? 'Sistema Editorial' : 'Editorial System',
          isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
          lang
        );

        await sendEmailViaExtension(taskData.assignedToEmail, emailTitle, htmlBody);
        console.log(`✅ Notificación ESPECIAL enviada al editor: ${taskData.assignedToEmail}`);

        // Registrar en audit log
        await db.collection('submissions').doc(taskData.submissionId)
          .collection('auditLogs').add({
            action: 'additional_reviewer_accepted',
            details: `Revisor adicional #${acceptedCount} (${newAssignment.reviewerName}) aceptó. Total: ${acceptedCount} revisores.`,
            taskId: taskId,
            reviewerEmail: newAssignment.reviewerEmail,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

        // Actualizar contador en la tarea
        await taskRef.update({
          acceptedReviewers: acceptedCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      } else {
        // ============================================================
        // CASO 3: MENOS DE 2 REVISORES - SOLO LOG
        // ============================================================
        console.log(`⏳ Solo ${acceptedCount} revisor(es). Esperando al menos 2. Faltan ${2 - acceptedCount}.`);
        
        // Actualizar contador en la tarea
        await taskRef.update({
          acceptedReviewers: acceptedCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentCreated:`, error.message);
      console.error(`❌ Stack:`, error.stack);
      
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'onReviewerAssignmentCreated',
          error: {
            message: error.message,
            stack: error.stack?.substring(0, 500)
          },
          assignmentId: newAssignmentId,
          reviewerEmail: newAssignment?.reviewerEmail,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error(`❌ Error al registrar error:`, logError.message);
      }
    }
  }
);
// ============================================================
// CONFIGURACIÓN GLOBAL DE ESTILOS (mismo patrón que processDocumentWithDocsAPI)
// ============================================================
const REVIEWS_STYLES = {
  COLORS: {
    academicBlue: { red: 0.0, green: 0.15, blue: 0.35 },
    darkCharcoal: { red: 0.08, green: 0.08, blue: 0.08 },
    bodyGray: { red: 0.15, green: 0.15, blue: 0.15 },
    academicRed: { red: 0.5, green: 0.0, blue: 0.0 },
    reviewerGreen: { red: 0.0, green: 0.3, blue: 0.1 }
  },
  TYPOGRAPHY: {
    title: { family: 'Open Sans', weight: 700, size: 16 },
    reviewerName: { family: 'Open Sans', weight: 600, size: 12 },
    sectionLabel: { family: 'Open Sans', weight: 600, size: 10 },
    body: { family: 'Lora', weight: 400, size: 10 },
    comment: { family: 'Lora', weight: 400, size: 9 },
    metadata: { family: 'Open Sans', weight: 400, size: 9 }
  }
};

// Esta función actualiza el número de revisores.

exports.onReviewerAssignmentSubmitted = onDocumentUpdated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: ['OAUTH2_CLIENT_ID', 'OAUTH2_CLIENT_SECRET', 'OAUTH2_REFRESH_TOKEN'],
    memory: '512MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const assignmentId = event.params.assignmentId;
    
    // Solo proceder si el estado cambió a 'submitted'
    if (beforeData.status === afterData.status || afterData.status !== 'submitted') {
      return;
    }
    
    console.log(`📝 [REVIEW COMPLETED] Nueva revisión: ${assignmentId} - ${afterData.reviewerEmail}`);
    
    const db = admin.firestore();
    const warnings = [];
    
    try {
      const taskId = afterData.editorialTaskId;
      if (!taskId) {
        console.warn('⚠️ Sin editorialTaskId. Abortando.');
        return { success: false, error: 'no_task_id' };
      }
      
      // ===== PASO 1: OBTENER DATOS DE LA TAREA Y SUBMISSION =====
      const taskRef = db.collection('editorialTasks').doc(taskId);
      const taskSnap = await taskRef.get();
      if (!taskSnap.exists) {
        console.error(`❌ Tarea no encontrada: ${taskId}`);
        return { success: false, error: 'task_not_found' };
      }
      
      const taskData = taskSnap.data();
      const submissionRef = db.collection('submissions').doc(taskData.submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        console.error(`❌ Submission no encontrado: ${taskData.submissionId}`);
        return { success: false, error: 'submission_not_found' };
      }
      
      // ===== PASO 2: CONTAR REVISIONES COMPLETADAS =====
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .where('status', '==', 'submitted')
        .get();
      
      const submittedCount = assignmentsSnapshot.size;
      const requiredReviews = taskData.requiredReviews || 2;
      
      console.log(`📊 Revisiones: ${submittedCount}/${requiredReviews}`);
      
      // ===== PASO 3: AUDIT LOG =====
      try {
        await db.collection('submissions').doc(taskData.submissionId)
          .collection('auditLogs').add({
            action: 'review_submitted',
            by: 'system',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: {
              reviewerEmail: afterData.reviewerEmail,
              reviewerId: assignmentId,
              submittedAt: afterData.submittedAt,
              currentCount: submittedCount,
              requiredCount: requiredReviews
            }
          });
      } catch (auditError) {
        console.warn(`⚠️ Error en audit log:`, auditError.message);
        warnings.push('audit_log_failed');
      }
      
      // ===== PASO 4: NOTIFICAR AL EDITOR (SIEMPRE) =====
      try {
        await notifyEditorNewReview(taskData, afterData, submittedCount, requiredReviews);
        console.log(`✅ Editor notificado`);
      } catch (notifyError) {
        console.warn(`⚠️ Error notificando al editor:`, notifyError.message);
        warnings.push('notify_editor_failed');
      }
      
      // ===== PASO 5: ACTUALIZAR CONTADOR EN LA TAREA =====
      try {
        await taskRef.update({
          completedReviews: submittedCount,
          lastReviewSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        console.warn(`⚠️ Error actualizando tarea:`, updateError.message);
        warnings.push('task_update_failed');
      }
      
      // ===== NO HACER NADA MÁS - EL EDITOR DECIDE CUÁNDO PROCEDER =====
      console.log(`✅ Revisión ${submittedCount}/${requiredReviews} registrada. Esperando decisión del editor.`);
      
      return {
        success: true,
        status: 'review_recorded',
        submittedCount,
        requiredReviews,
        warnings,
        message: 'Revisión registrada. El editor decidirá cuándo proceder a la decisión final.'
      };
      
    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentSubmitted:`, error.message);
      
      try {
        await db.collection('systemErrors').add({
          function: 'onReviewerAssignmentSubmitted',
          error: {
            message: error.message,
            stack: error.stack?.substring(0, 1000) || 'No stack'
          },
          assignmentId,
          taskId: afterData?.editorialTaskId || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          warnings
        });
      } catch (logError) {
        console.error(`❌ Error al registrar error:`, logError.message);
      }
      
      return {
        success: false,
        error: error.message,
        warnings
      };
    }
  }
);


// ===== FUNCIÓN AUXILIAR: Notificar al editor =====
async function notifyEditorNewReview(taskData, reviewData, submittedCount, requiredReviews) {
  const db = admin.firestore();
  
  // Obtener emails de los editores asignados
  const editorsSnapshot = await db.collection('editorialTasks')
    .doc(taskData.id)
    .collection('assignedEditors')
    .get();
  
  const editorEmails = editorsSnapshot.docs.map(doc => doc.data().email);
  
  if (editorEmails.length === 0) {
    console.warn('⚠️ No se encontraron editores asignados');
    return;
  }
  
  // Determinar idioma
  const lang = taskData.language || 'es';
  const isSpanish = lang === 'es';
  
  // Construir contenido del email
  const emailTitle = isSpanish
    ? `📝 Nueva revisión recibida (${submittedCount}/${requiredReviews})`
    : `📝 New review received (${submittedCount}/${requiredReviews})`;
    
  const emailGreeting = isSpanish
    ? 'Estimado/a Editor/a:'
    : 'Dear Editor:';
    
  const bodyContent = isSpanish
    ? `
      <p>Se ha completado una nueva revisión para el artículo:</p>
      
      <div class="highlight-box">
        <p><strong>Artículo:</strong> ${taskData.submissionTitle || taskData.submissionId}</p>
        <p><strong>Revisor:</strong> ${reviewData.reviewerName || reviewData.reviewerEmail}</p>
        <p><strong>Progreso:</strong> ${submittedCount}/${requiredReviews} revisiones completadas</p>
      </div>
      
      <p>Puede revisar los detalles en el panel editorial. Cuando todas las revisiones estén completas, podrá proceder a la decisión final.</p>
      
      <div class="button-container">
        <a href="https://www.revistacienciasestudiantes.com/es/editorial-panel" class="btn">IR AL PANEL EDITORIAL</a>
      </div>
    `
    : `
      <p>A new review has been completed for the article:</p>
      
      <div class="highlight-box">
        <p><strong>Article:</strong> ${taskData.submissionTitle || taskData.submissionId}</p>
        <p><strong>Reviewer:</strong> ${reviewData.reviewerName || reviewData.reviewerEmail}</p>
        <p><strong>Progress:</strong> ${submittedCount}/${requiredReviews} reviews completed</p>
      </div>
      
      <p>You can review the details in the editorial panel. When all reviews are complete, you can proceed to the final decision.</p>
      
      <div class="button-container">
        <a href="https://www.revistacienciasestudiantes.com/en/editorial-panel" class="btn">GO TO EDITORIAL PANEL</a>
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
  
  // Enviar email a cada editor usando sendEmailViaExtension
  for (const email of editorEmails) {
    try {
      await sendEmailViaExtension(
        email,
        emailTitle,
        htmlBody
      );
      console.log(`✅ Email enviado a editor: ${email}`);
    } catch (emailError) {
      console.error(`❌ Error enviando email a ${email}:`, emailError.message);
      throw emailError; // Propagar el error para que se registre
    }
  }
}

// src/functions/proceedToFinalDecision.js

/**
 * Función llamada explícitamente por el editor para proceder a la decisión final.
 * Crea el documento consolidado y actualiza estados.
 */
exports.proceedToFinalDecision = onCall(
  {
    secrets: ['OAUTH2_CLIENT_ID', 'OAUTH2_CLIENT_SECRET', 'OAUTH2_REFRESH_TOKEN'],
    memory: '512MiB'
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    
    const { taskId } = request.data;
    if (!taskId) {
      throw new functions.https.HttpsError('invalid-argument', 'Se requiere taskId');
    }
    
    const db = admin.firestore();
    const warnings = [];
    const errors = [];
    
    try {
      // ===== 1. OBTENER TAREA Y SUBMISSION =====
      const taskRef = db.collection('editorialTasks').doc(taskId);
      const taskSnap = await taskRef.get();
      
      if (!taskSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Tarea no encontrada');
      }
      
      const taskData = taskSnap.data();
      const submissionRef = db.collection('submissions').doc(taskData.submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Submission no encontrado');
      }
      
      const submissionData = submissionSnap.data();
      
      // ===== 2. VERIFICAR REVISIONES COMPLETADAS =====
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .where('status', '==', 'submitted')
        .get();
      
      const submittedCount = assignmentsSnapshot.size;
      const requiredReviews = taskData.requiredReviews || 2;
      
      if (submittedCount < requiredReviews) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Se necesitan al menos ${requiredReviews} revisiones. Actualmente hay ${submittedCount}.`
        );
      }
      
      console.log(`🎯 Procediendo a decisión final con ${submittedCount} revisiones...`);
      
      // ===== 3. INICIALIZAR GOOGLE DRIVE Y DOCS =====
      let drive;
      let docsClient;
      
      const driveClients = await getDriveClient(`consolidate-${taskId}`);
      drive = driveClients.drive;
      docsClient = driveClients.docs;
      
      if (!drive?.files?.copy) {
        throw new Error('Cliente de Google Drive mal inicializado');
      }
      if (!docsClient?.documents) {
        throw new Error('Cliente de Google Docs mal inicializado');
      }
      
      // ===== 4. EXTRAER COMENTARIOS DE TODAS LAS REVISIONES =====
      console.log(`📄 Extrayendo comentarios de ${assignmentsSnapshot.size} revisiones...`);
      
      const allDocumentComments = [];
      let commentsExtracted = 0;
      let commentsFailed = 0;
      
      for (const doc of assignmentsSnapshot.docs) {
        const reviewData = doc.data();
        const reviewerFileId = reviewData.reviewerFileId;
        const reviewerEmail = reviewData.reviewerEmail;
        const reviewerNumber = allDocumentComments.length + 1;
        
        if (!reviewerFileId) {
          console.warn(`⚠️ Revisor ${reviewerEmail} sin reviewerFileId`);
          warnings.push(`no_file_${reviewerEmail}`);
          
          allDocumentComments.push({
            reviewerNumber,
            reviewerEmail,
            documentComments: [],
            submittedAt: reviewData.submittedAt,
            hasDocumentComments: false
          });
          continue;
        }
        
        try {
          const comments = await extractCommentsFromDocument(drive, reviewerFileId);
          console.log(`✅ ${comments.length} comentarios de ${reviewerEmail}`);
          
          allDocumentComments.push({
            reviewerNumber,
            reviewerEmail,
            documentComments: comments,
            submittedAt: reviewData.submittedAt,
            hasDocumentComments: comments.length > 0
          });
          commentsExtracted++;
        } catch (commentError) {
          console.error(`❌ Error extrayendo comentarios de ${reviewerEmail}:`, commentError.message);
          warnings.push(`extract_failed_${reviewerEmail}`);
          commentsFailed++;
          
          allDocumentComments.push({
            reviewerNumber,
            reviewerEmail,
            documentComments: [],
            submittedAt: reviewData.submittedAt,
            hasDocumentComments: false,
            extractionError: commentError.message
          });
        }
      }
      
      // ===== 5. CREAR DOCUMENTO FINAL CONSOLIDADO =====
      let finalDocId = null;
      let finalDocUrl = null;
      
      try {
        let sourceFileId = null;
        let sourceMimeType = null;
        
        if (submissionData.formattedDocsFile?.id) {
          sourceFileId = submissionData.formattedDocsFile.id;
          sourceMimeType = 'application/vnd.google-apps.document';
          console.log(`✅ Usando documento formateado: ${sourceFileId}`);
        } else if (submissionData.originalFileId) {
          sourceFileId = submissionData.originalFileId;
          console.log(`⚠️ Usando documento original: ${sourceFileId}`);
          
          try {
            const fileMeta = await drive.files.get({
              fileId: sourceFileId,
              fields: 'mimeType'
            });
            sourceMimeType = fileMeta.data.mimeType;
          } catch (metaErr) {
            sourceMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            warnings.push('mime_type_assumed');
          }
        }
        
        if (!sourceFileId) {
          throw new Error('No se encontró documento fuente');
        }
        
        console.log(`📝 Creando documento final consolidado...`);
        
        const copyConfig = {
          fileId: sourceFileId,
          requestBody: {
            name: `FINAL_REVIEW_${submissionData.submissionId}`,
            parents: submissionData.editorialFolderId ? [submissionData.editorialFolderId] : undefined,
            copyRequiresWriterPermission: true,
            writersCanShare: false
          },
          fields: 'id, webViewLink, mimeType'
        };
        
        if (sourceMimeType === 'application/vnd.google-apps.document') {
          copyConfig.requestBody.mimeType = 'application/vnd.google-apps.document';
        }
        
        const finalCopy = await drive.files.copy(copyConfig);
        finalDocId = finalCopy.data.id;
        finalDocUrl = finalCopy.data.webViewLink;
        
        console.log(`✅ Documento final creado: ${finalDocId}`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Configurar permisos
        try {
          await configureEditorPermissions(drive, finalDocId, taskData, assignmentsSnapshot);
          console.log(`✅ Permisos configurados`);
        } catch (permError) {
          console.warn(`⚠️ Error configurando permisos:`, permError.message);
          warnings.push('permissions_error');
        }
        
        // Insertar comentarios en el documento
        try {
          await insertDocumentCommentsSection(
            drive,
            docsClient,
            finalDocId,
            allDocumentComments,
            submissionData
          );
          console.log(`✅ Comentarios insertados`);
        } catch (insertError) {
          console.error(`❌ Error insertando comentarios:`, insertError.message);
          warnings.push('insert_comments_failed');
          errors.push(insertError.message);
        }
        
      } catch (docError) {
        console.error(`❌ Error creando documento final:`, docError.message);
        await logSystemError('final_doc_failed', docError, taskId);
        warnings.push('final_doc_failed');
        errors.push(docError.message);
        
        throw new functions.https.HttpsError('internal', `Error creando documento: ${docError.message}`);
      }
      
      // ===== 6. PROGRAMAR ELIMINACIÓN DE DOCUMENTOS TEMPORALES =====
      try {
        const deleteAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        
        for (const doc of assignmentsSnapshot.docs) {
          const reviewData = doc.data();
          const reviewerFileId = reviewData.reviewerFileId;
          
          if (reviewerFileId) {
            await db.collection('scheduledDeletions').add({
              fileId: reviewerFileId,
              fileName: `REVIEW_COPY_${submissionData.submissionId}`,
              submissionId: submissionData.submissionId,
              reviewerEmail: reviewData.reviewerEmail,
              scheduledFor: admin.firestore.Timestamp.fromDate(deleteAt),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              status: 'pending',
              reason: 'Documentos individuales consolidados en documento final',
              finalDocId
            });
          }
        }
        
        console.log(`✅ Eliminaciones programadas para ${assignmentsSnapshot.size} documentos`);
      } catch (deleteSchedError) {
        console.warn(`⚠️ Error programando eliminaciones:`, deleteSchedError.message);
        warnings.push('schedule_deletion_failed');
      }
      
      // ===== 7. ACTUALIZAR SUBMISSION CON REFERENCIA AL DOCUMENTO FINAL =====
      await submissionRef.update({
        finalReviewDocId: finalDocId,
        finalReviewDocUrl: finalDocUrl,
        reviewsConsolidatedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalReviewsReceived: submittedCount,
        requiredReviews,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // ===== 8. CAMBIAR ESTADO A AWAITING_EDITOR_DECISION =====
      await updateTaskStatusSafely(db, taskRef, submissionRef, submittedCount, finalDocId, finalDocUrl);
      
      // ===== 9. ENVIAR EMAIL AL EDITOR =====
      try {
        await sendEditorDecisionEmail(
          taskData,
          submissionData,
          assignmentsSnapshot,
          submittedCount,
          finalDocUrl
        );
        console.log(`✅ Email enviado al editor`);
      } catch (emailError) {
        console.warn(`⚠️ Error enviando email:`, emailError.message);
        warnings.push('email_failed');
      }
      
      // ===== 10. AUDIT LOG =====
      try {
        await db.collection('submissions')
          .doc(taskData.submissionId)
          .collection('auditLogs')
          .add({
            action: 'proceeded_to_decision',
            by: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: {
              taskId,
              submittedCount,
              requiredReviews,
              finalDocId,
              finalDocUrl,
              reviewersProcessed: allDocumentComments.length,
              reviewerEmails: allDocumentComments.map(r => r.reviewerEmail),
              commentsExtracted,
              commentsFailed,
              warnings,
              errors
            }
          });
      } catch (auditError) {
        console.warn(`⚠️ Error en audit log:`, auditError.message);
      }
      
      console.log(`✅ Proceso de consolidación completado`);
      
      return {
        success: true,
        finalDocId,
        finalDocUrl,
        submittedCount,
        requiredReviews,
        reviewersProcessed: allDocumentComments.length,
        commentsExtracted,
        commentsFailed,
        warnings,
        errors
      };
      
    } catch (error) {
      console.error(`❌ Error en proceedToFinalDecision:`, error.message);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);
// ============================================================
// FUNCIÓN: INSERTAR SOLO COMENTARIOS DEL DOCUMENTO (VERSIÓN CORREGIDA)
 // ============================================================
async function insertDocumentCommentsSection(drive, docsClient, finalDocId, allDocumentComments, submissionData) {
  const requestId = `insert-comments-${finalDocId?.substring(0, 8) || 'unknown'}`;
  console.log(`[${requestId}] 📝 Insertando comentarios del documento...`);

  if (!docsClient?.documents) {
    throw new Error('docsClient no inicializado');
  }

  // ==================== CLEAN TEXT ====================
  function cleanText(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-zA-Z0-9#]+;/g, (match) => {
        const entities = { '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú', '&ntilde;': 'ñ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
        return entities[match] || String.fromCharCode(parseInt(match.replace(/&#?(\d+);/, '$1'))) || match;
      })
      .trim();
  }

  // ==================== COLORES Y TIPOGRAFÍA ====================
  const C = {
    titleBlue: { red: 0.05, green: 0.20, blue: 0.40 },
    darkGray: { red: 0.12, green: 0.12, blue: 0.12 },
    bodyGray: { red: 0.22, green: 0.22, blue: 0.22 },
    accentBlue: { red: 0.10, green: 0.35, blue: 0.55 },
    lightGray: { red: 0.55, green: 0.55, blue: 0.55 },
    quotedBg: { red: 0.96, green: 0.96, blue: 0.98 },
    greenAccent: { red: 0.05, green: 0.40, blue: 0.20 }
  };

  const T = {
    titleFont: 'Open Sans',
    bodyFont: 'Lora',
    monoFont: 'Courier New'
  };

  const document = await docsClient.documents.get({ documentId: finalDocId });
  let pos = document.data.body.content[document.data.body.content.length - 1].endIndex - 1;

  const requests = [];

  // ==================== HELPER addText MEJORADO ====================
 // ==================== HELPER MEJORADO ====================
function addText(text, textStyle = {}, paraStyle = {}) {
  const clean = cleanText(text);
  if (!clean) return;

  // Insertamos siempre con \n al final para forzar nuevo párrafo
  const textToInsert = clean.endsWith('\n') ? clean : clean + '\n';

  requests.push({
    insertText: {
      location: { index: pos },
      text: textToInsert
    }
  });

  const textEnd = pos + textToInsert.length;

  // Text Style
  if (Object.keys(textStyle).length > 0) {
    const fields = Object.keys(textStyle).filter(key => 
      ['bold','italic','fontSize','foregroundColor','weightedFontFamily','backgroundColor'].includes(key)
    );
    
    if (fields.length > 0) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: pos, endIndex: textEnd },
          textStyle: textStyle,
          fields: fields.join(',')
        }
      });
    }
  }

  // Paragraph Style - Valores generosos
  const finalParaStyle = {
    lineSpacing: 145,
    spaceAbove: { magnitude: 10, unit: 'PT' },
    spaceBelow: { magnitude: 18, unit: 'PT' },
    ...paraStyle
  };

  const paraFields = ['lineSpacing', 'spaceAbove', 'spaceBelow', 'alignment', 'indentStart', 'indentEnd', 'indentFirstLine'];
  
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: pos, endIndex: textEnd },
      paragraphStyle: finalParaStyle,
      fields: paraFields.filter(f => finalParaStyle[f] !== undefined).join(',')
    }
  });

  pos = textEnd;   // Actualizamos posición
}
  // ==================== 1. SALTO DE PÁGINA ====================
  requests.push({ insertPageBreak: { location: { index: pos } } });
  pos++;

  // ==================== 2. TÍTULO ====================
  const reviewDate = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

  addText('\n\n', {}, { spaceBelow: { magnitude: 40, unit: 'PT' } });

  addText('DOCUMENT COMMENTS REPORT\n', {
    weightedFontFamily: { fontFamily: T.titleFont, weight: 700 },
    fontSize: { magnitude: 22, unit: 'PT' },
    foregroundColor: { color: { rgbColor: C.titleBlue } }
  }, {
    alignment: 'CENTER',
    spaceBelow: { magnitude: 8, unit: 'PT' }
  });

  addText('Comentarios Extraídos del Documento\n', {
    weightedFontFamily: { fontFamily: T.titleFont, weight: 400 },
    fontSize: { magnitude: 11, unit: 'PT' },
    foregroundColor: { color: { rgbColor: C.lightGray } },
    italic: true
  }, {
    alignment: 'CENTER',
    spaceBelow: { magnitude: 32, unit: 'PT' }
  });

  // ==================== METADATOS ====================
  addText(`Article: ${submissionData.title || 'Untitled'}\n`, {
    weightedFontFamily: { fontFamily: T.bodyFont, weight: 400 },
    fontSize: { magnitude: 11, unit: 'PT' },
    foregroundColor: { color: { rgbColor: C.bodyGray } }
  }, { alignment: 'CENTER', spaceBelow: { magnitude: 6, unit: 'PT' } });

  addText(`Submission: ${submissionData.submissionId || 'N/A'}  ·  Reviews: ${allDocumentComments.length}  ·  ${reviewDate}\n`, {
    weightedFontFamily: { fontFamily: T.monoFont, weight: 400 },
    fontSize: { magnitude: 9, unit: 'PT' },
    foregroundColor: { color: { rgbColor: C.lightGray } }
  }, { alignment: 'CENTER', spaceBelow: { magnitude: 48, unit: 'PT' } });

  // ==================== 3. CONTENIDO POR REVISOR ====================
  for (let i = 0; i < allDocumentComments.length; i++) {
    const review = allDocumentComments[i];
    const rn = review.reviewerNumber || '?';

    // Título del revisor
    addText(`\nReviewer ${rn}\n`, {
      weightedFontFamily: { fontFamily: T.titleFont, weight: 700 },
      fontSize: { magnitude: 15, unit: 'PT' },
      foregroundColor: { color: { rgbColor: C.titleBlue } }
    }, {
      spaceAbove: { magnitude: 28, unit: 'PT' },
      spaceBelow: { magnitude: 16, unit: 'PT' }
    });

    const docComments = review.documentComments || [];
    const mainComments = docComments.filter(c => !c.isReply);

    if (mainComments.length > 0) {
      addText(`Document Comments (${mainComments.length})\n`, {
        weightedFontFamily: { fontFamily: T.titleFont, weight: 600 },
        fontSize: { magnitude: 10.5, unit: 'PT' },
        foregroundColor: { color: { rgbColor: C.greenAccent } }
      }, {
        spaceAbove: { magnitude: 18, unit: 'PT' },
        spaceBelow: { magnitude: 12, unit: 'PT' },
        indentStart: { magnitude: 12, unit: 'PT' }
      });

      let commentCounter = 0;

      for (const item of docComments) {
        if (item.isReply) {
          addText(`↳ ${item.content}\n`, {
            weightedFontFamily: { fontFamily: T.bodyFont, weight: 400 },
            fontSize: { magnitude: 9.5, unit: 'PT' },
            foregroundColor: { color: { rgbColor: C.lightGray } },
            italic: true
          }, {
            spaceBelow: { magnitude: 10, unit: 'PT' },
            indentStart: { magnitude: 48, unit: 'PT' }
          });
        } else {
          commentCounter++;

          // Texto citado
          if (item.quotedText && cleanText(item.quotedText)) {
            const quotedClean = cleanText(item.quotedText);
            const quotedPreview = quotedClean.length > 220 ? quotedClean.substring(0, 220) + '...' : quotedClean;

            addText(`"${quotedPreview}"\n`, {
              weightedFontFamily: { fontFamily: T.bodyFont, weight: 400 },
              fontSize: { magnitude: 9.5, unit: 'PT' },
              foregroundColor: { color: { rgbColor: C.lightGray } },
              italic: true,
              backgroundColor: { color: { rgbColor: C.quotedBg } }
            }, {
              spaceBelow: { magnitude: 10, unit: 'PT' },
              indentStart: { magnitude: 28, unit: 'PT' }
            });
          }

          // Comentario principal
          const commentClean = cleanText(item.content);
          addText(`${commentCounter}. ${commentClean}\n`, {
            weightedFontFamily: { fontFamily: T.bodyFont, weight: 400 },
            fontSize: { magnitude: 10.8, unit: 'PT' },
            foregroundColor: { color: { rgbColor: C.bodyGray } }
          }, {
            spaceBelow: { magnitude: 18, unit: 'PT' },   // ← más espacio aquí
            indentStart: { magnitude: 28, unit: 'PT' }
          });
        }
      }
    } else {
      addText('No document comments\n', {
        weightedFontFamily: { fontFamily: T.bodyFont, weight: 400 },
        fontSize: { magnitude: 10, unit: 'PT' },
        foregroundColor: { color: { rgbColor: C.lightGray } },
        italic: true
      }, { spaceBelow: { magnitude: 24, unit: 'PT' }, indentStart: { magnitude: 12, unit: 'PT' } });
    }

    // Separador entre revisores (menos intrusivo)
    if (i < allDocumentComments.length - 1) {
      addText('\n· · · · ·\n', {
        fontSize: { magnitude: 8, unit: 'PT' },
        foregroundColor: { color: { rgbColor: C.lightGray } }
      }, {
        alignment: 'CENTER',
        spaceAbove: { magnitude: 24, unit: 'PT' },
        spaceBelow: { magnitude: 32, unit: 'PT' }
      });
    }
  }

  // ==================== PIE DE PÁGINA ====================
  addText('\n\n', {}, { spaceBelow: { magnitude: 32, unit: 'PT' } });

  addText('━'.repeat(60) + '\n', {
    fontSize: { magnitude: 6, unit: 'PT' },
    foregroundColor: { color: { rgbColor: C.accentBlue } }
  }, { alignment: 'CENTER', spaceBelow: { magnitude: 12, unit: 'PT' } });

  addText('END OF DOCUMENT COMMENTS\n', {
    weightedFontFamily: { fontFamily: T.titleFont, weight: 600 },
    fontSize: { magnitude: 9, unit: 'PT' },
    foregroundColor: { color: { rgbColor: C.lightGray } }
  }, { alignment: 'CENTER', spaceBelow: { magnitude: 8, unit: 'PT' } });

  addText(`🔒 CONFIDENTIAL — Generated ${reviewDate}\n`, {
    weightedFontFamily: { fontFamily: T.monoFont, weight: 400 },
    fontSize: { magnitude: 7.5, unit: 'PT' },
    foregroundColor: { color: { rgbColor: { red: 0.60, green: 0.15, blue: 0.15 } } }
  }, { alignment: 'CENTER' });

  // ==================== EJECUTAR EN LOTES ====================
  console.log(`[${requestId}] 🎨 Aplicando ${requests.length} solicitudes...`);

  for (let i = 0; i < requests.length; i += 50) {
    const batch = requests.slice(i, i + 50);
    await docsClient.documents.batchUpdate({
      documentId: finalDocId,
      requestBody: { requests: batch }
    });
  }

  console.log(`[${requestId}] ✅ Comentarios insertados correctamente`);
  return { success: true, reviewersIncluded: allDocumentComments.length };
}
// ============================================================
// FUNCIÓN: EXTRAER COMENTARIOS DEL DOCUMENTO
// ============================================================
async function extractCommentsFromDocument(drive, fileId) {
  console.log(`   🔍 Extrayendo comentarios de: ${fileId}`);
  
  try {
    const commentsResponse = await drive.comments.list({
      fileId: fileId,
      fields: 'comments(id,createdTime,modifiedTime,htmlContent,content,deleted,resolved,quotedFileContent(value,mimeType),anchor,replies(id,createdTime,modifiedTime,htmlContent,content,deleted))',
      pageSize: 100
    });
    
    const allComments = commentsResponse.data.comments || [];
    console.log(`   📄 ${allComments.length} hilos de comentarios encontrados`);
    
    const extractedComments = [];
    
    for (const comment of allComments) {
      let quotedText = '';
      if (comment.quotedFileContent?.value) {
        quotedText = comment.quotedFileContent.value
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
      }
      
      if (!quotedText && comment.htmlContent) {
        const match = comment.htmlContent.match(/sobre "([^"]+)"/);
        if (match) {
          quotedText = match[1];
        }
      }
      
      const replies = [];
      if (comment.replies && comment.replies.length > 0) {
        for (const reply of comment.replies) {
          replies.push({
            id: reply.id,
            content: reply.content || '',
            htmlContent: reply.htmlContent || '',
            createdTime: reply.createdTime,
            modifiedTime: reply.modifiedTime,
            deleted: reply.deleted || false
          });
        }
      }
      
      extractedComments.push({
        id: comment.id,
        content: comment.content || '',
        htmlContent: comment.htmlContent || '',
        quotedText: quotedText,
        anchor: comment.anchor || null,
        createdTime: comment.createdTime,
        modifiedTime: comment.modifiedTime,
        resolved: comment.resolved || false,
        deleted: comment.deleted || false,
        isReply: false,
        replies: replies
      });
      
      for (const reply of replies) {
        extractedComments.push({
          id: reply.id,
          content: reply.content || '',
          htmlContent: reply.htmlContent || '',
          quotedText: quotedText,
          anchor: comment.anchor || null,
          parentId: comment.id,
          createdTime: reply.createdTime,
          modifiedTime: reply.modifiedTime,
          deleted: reply.deleted || false,
          isReply: true,
          replies: []
        });
      }
    }
    
    const mainComments = extractedComments.filter(c => !c.isReply).length;
    const replyCount = extractedComments.filter(c => c.isReply).length;
    console.log(`   ✅ Total: ${mainComments} comentarios + ${replyCount} respuestas`);
    
    return extractedComments;
    
  } catch (error) {
    console.error(`   ❌ Error extrayendo comentarios:`, error.message);
    
    try {
      console.log(`   🔄 Intentando fallback...`);
      const basicResponse = await drive.comments.list({
        fileId: fileId,
        fields: 'comments(id,content,htmlContent,quotedFileContent(value),createdTime,resolved,deleted)',
        pageSize: 100
      });
      
      const basicComments = (basicResponse.data.comments || []).map(c => ({
        id: c.id,
        content: c.content || '',
        htmlContent: c.htmlContent || '',
        quotedText: c.quotedFileContent?.value?.replace(/<[^>]*>/g, '').trim() || '',
        anchor: null,
        createdTime: c.createdTime,
        resolved: c.resolved || false,
        deleted: c.deleted || false,
        isReply: false,
        replies: []
      }));
      
      console.log(`   ✅ Fallback: ${basicComments.length} comentarios`);
      return basicComments;
      
    } catch (fallbackError) {
      console.error(`   ❌ Fallback falló:`, fallbackError.message);
      return [];
    }
  }
}

// ============================================================
// FUNCIÓN AUXILIAR: REGISTRAR ERRORES DEL SISTEMA
// ============================================================
async function logSystemError(type, error, context) {
  try {
    const db = admin.firestore();
    await db.collection('systemErrors').add({
      type,
      function: 'onReviewerAssignmentSubmitted',
      error: {
        message: error.message,
        stack: error.stack?.substring(0, 1000) || 'No stack'
      },
      context,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('Error logging to Firestore:', e.message);
  }
}
// ============================================================
// FUNCIÓN AUXILIAR: Configurar permisos del editor
// ============================================================
async function configureEditorPermissions(drive, fileId, taskData, assignmentsSnapshot) {
  try {
    // Otorgar permiso al editor asignado
    if (taskData.assignedToEmail) {
      const editorPerm = {
        role: 'writer',
        type: 'user',
        emailAddress: taskData.assignedToEmail
      };
      
      await drive.permissions.create({
        fileId: fileId,
        requestBody: editorPerm,
        sendNotificationEmail: false,
        fields: 'id'
      });
      console.log(`✅ Permiso de editor otorgado a: ${taskData.assignedToEmail}`);
    }
    
    // Eliminar permisos de revisores (no bloqueante)
    try {
      const existingPermissions = await drive.permissions.list({
        fileId: fileId,
        fields: 'permissions(id, emailAddress, role)'
      });
      
      for (const perm of existingPermissions.data.permissions) {
        if (perm.role === 'owner') continue;
        
        const isReviewer = assignmentsSnapshot.docs.some(
          revDoc => revDoc.data().reviewerEmail === perm.emailAddress
        );
        
        if (isReviewer) {
          try {
            await drive.permissions.delete({
              fileId: fileId,
              permissionId: perm.id
            });
            console.log(`🔒 Permiso de revisor eliminado: ${perm.emailAddress}`);
          } catch (deleteErr) {
            // Ignorar si no se puede eliminar
          }
        }
      }
    } catch (listError) {
      console.warn(`⚠️ Error listando permisos:`, listError.message);
    }
    
  } catch (error) {
    console.warn(`⚠️ Error en configureEditorPermissions:`, error.message);
    throw error;
  }
}

// ============================================================
// FUNCIÓN AUXILIAR: Actualizar estados de forma segura
// ============================================================
async function updateTaskStatusSafely(db, taskRef, submissionRef, submittedCount, finalDocId, finalDocUrl) {
  try {
    await db.runTransaction(async (transaction) => {
      const taskTxSnap = await transaction.get(taskRef);
      if (!taskTxSnap.exists) return;
      
      const currentTaskStatus = taskTxSnap.data().status;
      
      if (currentTaskStatus === 'reviews-in-progress') {
        const updateData = {
          status: 'awaiting-decision',
          reviewsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedReviews: submittedCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (finalDocId) {
          updateData.finalReviewDocId = finalDocId;
          updateData.finalReviewDocUrl = finalDocUrl;
        }
        
        transaction.update(taskRef, updateData);

        transaction.update(submissionRef, {
          status: 'awaiting-editor-decision',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Estados actualizados: awaiting-decision`);
      }
    });
  } catch (txError) {
    console.warn(`⚠️ Error actualizando estados:`, txError.message);
  }
}


// ============================================================
// FUNCIÓN: ENVIAR EMAIL AL EDITOR
// ============================================================
async function sendEditorDecisionEmail(taskData, submissionData, assignmentsSnapshot, submittedCount, finalDocUrl) {
  const lang = submissionData.paperLanguage || 'es';
  const isSpanish = lang === 'es';
  
  // Construir lista de revisiones
  let reviewsListHtml = '';
  
  assignmentsSnapshot.docs.forEach((doc, index) => {
    const review = doc.data();
    
    let recommendationText = review.recommendation || 'No especificada';
    if (isSpanish) {
      const recMap = {
        'accept': 'Aceptar',
        'minor-revision': 'Revisiones menores',
        'major-revision': 'Revisiones mayores',
        'reject': 'Rechazar'
      };
      recommendationText = recMap[review.recommendation] || recommendationText;
    }
    
    reviewsListHtml += `
      <div style="background-color: #f9f9f9; padding: 15px; margin-bottom: 15px; border-left: 4px solid #007398; border-radius: 4px;">
        <p><strong>Revisor ${index + 1}:</strong></p>
        <p><strong>Recomendación:</strong> ${recommendationText}</p>
        <p><strong>Comentarios para el autor:</strong><br>${(review.commentsToAuthor || 'Sin comentarios').substring(0, 300)}...</p>
      </div>
    `;
  });
  
  const emailTitle = isSpanish
    ? `📋 Revisiones completadas: "${submissionData.title.substring(0, 60)}..."`
    : `📋 Reviews completed: "${submissionData.title.substring(0, 60)}..."`;

  const emailGreeting = isSpanish
    ? `Estimado/a ${taskData.assignedToName || 'Editor/a'}:`
    : `Dear ${taskData.assignedToName || 'Editor'}:`;

  const bodyContent = isSpanish
    ? `
      <p>El artículo ha recibido las <strong>${submittedCount} revisiones requeridas</strong>.</p>
      
      <div class="highlight-box">
        <p class="article-title">📚 "${submissionData.title}"</p>
        <p><strong>ID:</strong> ${submissionData.submissionId}</p>
      </div>
      
      <h3>📋 Revisiones:</h3>
      ${reviewsListHtml}
      
      <div class="info-box" style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0;">✅ Documento final con revisiones</h3>
        <p>Se ha creado un documento consolidado con todas las revisiones al final del manuscrito.</p>
      </div>
      
      <div class="button-container">
        <a href="${finalDocUrl}" class="btn">📄 VER DOCUMENTO FINAL</a>
      </div>
      
      <p style="color: #666; font-size: 13px; margin-top: 20px;">
        <em>Los documentos temporales de los revisores se eliminarán automáticamente en 5 días.</em>
      </p>
    `
    : `
      <p>The article has received the <strong>${submittedCount} required reviews</strong>.</p>
      
      <div class="highlight-box">
        <p class="article-title">📚 "${submissionData.title}"</p>
        <p><strong>ID:</strong> ${submissionData.submissionId}</p>
      </div>
      
      <h3>📋 Reviews:</h3>
      ${reviewsListHtml}
      
      <div class="info-box" style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0;">✅ Final document with reviews</h3>
        <p>A consolidated document has been created with all reviews at the end of the manuscript.</p>
      </div>
      
      <div class="button-container">
        <a href="${finalDocUrl}" class="btn">📄 VIEW FINAL DOCUMENT</a>
      </div>
      
      <p style="color: #666; font-size: 13px; margin-top: 20px;">
        <em>Reviewer temporary documents will be automatically deleted in 5 days.</em>
      </p>
    `;

  const htmlBody = getEmailTemplate(
    emailTitle,
    emailGreeting,
    bodyContent,
    isSpanish ? 'Sistema Editorial' : 'Editorial System',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );

  await sendEmailViaExtension(taskData.assignedToEmail, emailTitle, htmlBody);
  console.log(`✅ Email enviado al editor: ${taskData.assignedToEmail}`);
}
// ===================== FUNCIÓN AUXILIAR PARA COLORES DE RECOMENDACIÓN =====================
function getRecommendationColor(recommendation) {
  switch (recommendation) {
    case 'accept': return '#28a745';
    case 'minor-revision': return '#ffc107';
    case 'major-revision': return '#fd7e14';
    case 'reject': return '#dc3545';
    default: return '#6c757d';
  }
}
// ===================== SUBMIT REVISION =====================
// ===================== SUBMIT REVISION =====================
// ===================== SUBMIT REVISION =====================
exports.submitRevision = onRequest(
  { 
    secrets: [OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN],
    cors: true,
    timeoutSeconds: 300,
    memory: '1GiB'
  },
  async (req, res) => {
    if (handleCors(req, res)) return;
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const token = req.headers.authorization?.split('Bearer ')[1];
      if (!token) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      
      const { submissionId, fileBase64, fileName, notes, round, revisionComment } = req.body;
      
      if (!submissionId || !fileBase64 || !fileName) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
      }
      
      const db = admin.firestore();
      
      const submissionRef = db.collection('submissions').doc(submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        return res.status(404).json({ error: 'Submission no encontrado' });
      }
      
      const submission = submissionSnap.data();
      
      if (submission.authorUID !== uid) {
        return res.status(403).json({ error: 'No eres el autor de este artículo' });
      }
      
      // ✅ CORREGIDO: getDriveClient devuelve { drive, docs, oauth2Client }
      const clients = await getDriveClient();
      const drive = clients.drive;  // ← EXTRAER drive del objeto
      
      const folderId = submission.editorialFolderId || submission.driveFolderId;
      
      if (!folderId) {
        return res.status(500).json({ error: 'No hay carpeta de Drive asociada' });
      }
      
      const revisionFileName = `REVISION_R${round + 1}_${Date.now()}_${fileName}`;
      
      // ✅ uploadToDrive recibe (drive, fileBase64, fileName, folderId)
      const file = await uploadToDrive(drive, fileBase64, revisionFileName, folderId);
      
      const versionRef = db.collection('submissions').doc(submissionId).collection('versions');
      await versionRef.add({
        version: round + 1,
        fileId: file.id,
        fileUrl: file.webViewLink,
        fileName: revisionFileName,
        fileSize: file.size,
        revisionComment: revisionComment || null,
        notes: notes || '',
        type: 'revision',
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        uploadedBy: uid,
        uploadedByEmail: decodedToken.email
      });
      
      await submissionRef.update({
        status: 'in-desk-review',
        lastRevisionAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRevisionComment: revisionComment || null, 
        lastRevisionHasComment: !!revisionComment, 
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const auditLogRef = db.collection('submissions').doc(submissionId).collection('auditLogs');
      await auditLogRef.add({
        action: 'revision_submitted',
        round: round + 1,
        notes: notes,
        hasDetailedComment: !!revisionComment,
        revisionCommentPreview: revisionComment 
          ? revisionComment.replace(/<[^>]*>/g, '').substring(0, 150) + (revisionComment.replace(/<[^>]*>/g, '').length > 150 ? '...' : '')
          : null,
        fileName: revisionFileName,
        by: uid,
        byEmail: decodedToken.email,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return res.json({
        success: true,
        fileUrl: file.webViewLink,
        message: 'Revisión subida exitosamente'
      });
      
    } catch (error) {
      console.error('Error en submitRevision:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }
);
// ===================== CREATE IMMUTABLE HISTORY =====================
exports.createImmutableHistory = onCall(
  {
    secrets: [],
    memory: '512MiB'
  },
  async (request) => {
    const { HttpsError } = require("firebase-functions/v2/https");
    
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
      }
      
      const { submissionId } = request.data;
      const db = admin.firestore();
      const crypto = require('crypto');
      
      // Verificar permisos (solo editores pueden crear historia)
      const userDoc = await db.collection('users').doc(request.auth.uid).get();
      const userRoles = userDoc.data()?.roles || [];
      if (!userRoles.includes('Director General') && !userRoles.includes('Editor en Jefe')) {
        throw new HttpsError('permission-denied', 'No tienes permiso');
      }
      
      // Obtener TODOS los datos del submission
      const submissionDoc = await db.collection('submissions').doc(submissionId).get();
      if (!submissionDoc.exists) {
        throw new HttpsError('not-found', 'Submission no encontrado');
      }
      
      const submission = submissionDoc.data();
      
      // Obtener revisiones editoriales
      const editorialReviews = await db.collection('editorialReviews')
        .where('submissionId', '==', submissionId)
        .orderBy('createdAt', 'asc')
        .get();
      
      // Obtener asignaciones de revisores
      const reviewerAssignments = await db.collection('reviewerAssignments')
        .where('submissionId', '==', submissionId)
        .get();
      
      // Obtener todas las versiones del manuscrito
      const versions = await db.collection('submissions').doc(submissionId)
        .collection('versions')
        .orderBy('version', 'asc')
        .get();
      
      // Obtener audit logs
      const auditLogs = await db.collection('submissions').doc(submissionId)
        .collection('auditLogs')
        .orderBy('timestamp', 'asc')
        .get();
      
      // Construir el objeto de historia inmutable
      const immutableHistory = {
        version: "1.0.0",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        submissionId: submissionId,
        
        // Datos originales (inmutables)
        originalData: submission.originalSubmission || {
          title: submission.title,
          abstract: submission.abstract,
          keywords: submission.keywords,
          authors: submission.authors,
          submittedAt: submission.createdAt,
          paperLanguage: submission.paperLanguage,
          articleType: submission.articleType,
          area: submission.area,
          funding: submission.funding,
          conflictOfInterest: submission.conflictOfInterest,
          dataAvailability: submission.dataAvailability,
          codeAvailability: submission.codeAvailability,
          acknowledgments: submission.acknowledgments
        },
        
        // Metadatos finales (refinados)
        finalMetadata: submission.currentMetadata || {
          title: submission.title,
          titleEn: submission.titleEn,
          abstract: submission.abstract,
          abstractEn: submission.abstractEn,
          keywords: submission.keywords,
          keywordsEn: submission.keywordsEn,
          authors: normalizeAuthors(submission.authors)
        },
        
        // Todo el proceso de revisión
        reviewProcess: {
          editorialReviews: editorialReviews.docs.map(doc => ({
            id: doc.id,
            round: doc.data().round,
            decision: doc.data().decision,
            feedbackToAuthor: doc.data().feedbackToAuthor,
            completedAt: doc.data().completedAt
          })),
          
          peerReviews: reviewerAssignments.docs.map(doc => ({
            id: doc.id,
            reviewerName: doc.data().reviewerName,
            recommendation: doc.data().recommendation,
            scores: doc.data().scores,
            commentsToAuthor: doc.data().commentsToAuthor,
            submittedAt: doc.data().submittedAt
          })),
          
          finalDecision: {
            madeBy: submission.decisionMadeBy,
            madeAt: submission.decisionMadeAt,
            decision: submission.finalDecision,
            feedback: submission.finalFeedback
          }
        },
        
        // Todas las versiones del manuscrito
        manuscriptVersions: versions.docs.map(doc => ({
          version: doc.data().version,
          fileUrl: doc.data().fileUrl,
          fileName: doc.data().fileName,
          uploadedAt: doc.data().uploadedAt,
          type: doc.data().type,
          notes: doc.data().notes
        })),
        
        // Línea de tiempo completa
        timeline: buildTimeline(auditLogs, submission),
        
        // Metadatos de la publicación final
        publicationMetadata: {
          volumen: submission.volumen,
          numero: submission.numero,
          primeraPagina: submission.primeraPagina,
          ultimaPagina: submission.ultimaPagina,
          fechaPublicacion: submission.acceptedDate,
          doi: submission.doi || `10.1234/rnce.${submissionId}`
        },
        
        // Hash para verificar integridad
        hash: null
      };
      
      // Calcular hash
      const hashObj = { ...immutableHistory };
      delete hashObj.hash;
      const hashString = JSON.stringify(hashObj, (key, value) => {
        if (value && typeof value.toDate === 'function') {
          return value.toDate().toISOString();
        }
        return value;
      });
      
      immutableHistory.hash = crypto
        .createHash('sha256')
        .update(hashString)
        .digest('hex');
      
      // Guardar la historia inmutable
      const historyRef = await db.collection('immutableHistories').add(immutableHistory);
      
      // Actualizar el submission
      await submissionDoc.ref.update({
        immutableHistoryId: historyRef.id,
        immutableHistoryCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'archived'
      });
      
      return {
        success: true,
        historyId: historyRef.id,
        hash: immutableHistory.hash
      };
      
    } catch (error) {
      console.error('❌ Error creando historia inmutable:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// Funciones auxiliares para createImmutableHistory
function normalizeAuthors(authors) {
  return authors.map(author => ({
    firstName: author.firstName,
    lastName: author.lastName,
    fullName: `${author.firstName} ${author.lastName}`,
    orcid: author.orcid || null,
    institution: author.institution,
    email: author.email,
    isCorresponding: author.isCorresponding || false
  }));
}

function buildTimeline(auditLogs, submission) {
  const timeline = [];
  
  timeline.push({
    event: 'submitted',
    at: submission.createdAt,
    by: submission.authorEmail,
    details: 'Manuscrito enviado'
  });
  
  auditLogs.docs.forEach(log => {
    timeline.push({
      event: log.data().action,
      at: log.data().timestamp,
      by: log.data().byEmail || log.data().by,
      details: log.data().notes || log.data().decision
    });
  });
  
  if (submission.finalDecision === 'accept') {
    timeline.push({
      event: 'accepted',
      at: submission.decisionMadeAt,
      by: submission.decisionMadeBy,
      details: 'Artículo aceptado para publicación'
    });
  }
  
  return timeline.sort((a, b) => {
    const aTime = a.at?.toDate?.() || new Date(a.at);
    const bTime = b.at?.toDate?.() || new Date(b.at);
    return aTime - bTime;
  });
}
// ===================== NOTIFICAR EDITOR SOBRE RESPUESTA DE METADATOS =====================
// ===================== NOTIFICAR EDITOR SOBRE RESPUESTA DE METADATOS =====================
exports.onMetadataProposalResponse = onDocumentUpdated(
  {
    document: 'submissions/{submissionId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    const beforeStatus = beforeData.metadataRefinement?.status;
    const afterStatus = afterData.metadataRefinement?.status;
    
    if (beforeStatus === afterStatus) return;
    
    if (beforeStatus === 'pending-author' && (afterStatus === 'pending-editor' || afterStatus === 'rejected')) {
      console.log(`📝 Autor respondió a propuesta para ${event.params.submissionId}`);
      
      try {
        const db = admin.firestore();
        
        const tasksSnapshot = await db.collection('editorialTasks')
          .where('submissionId', '==', event.params.submissionId)
          .where('status', '==', 'completed')
          .limit(1)
          .get();
        
        if (!tasksSnapshot.empty) {
          const task = tasksSnapshot.docs[0].data();
          
          const isSpanish = afterData.paperLanguage === 'es';
          const authorResponse = afterData.metadataRefinement.authorResponse;
          
          const emailSubject = isSpanish
            ? `Respuesta del autor a propuesta de metadatos - ${afterData.title.substring(0, 50)}`
            : `Author response to metadata proposal - ${afterData.title.substring(0, 50)}`;
          
          const emailBody = isSpanish
            ? `
              <p>El autor ha respondido a tu propuesta de cambios en los metadatos.</p>
              <p><strong>Artículo:</strong> ${afterData.title}</p>
              <p><strong>Respuesta:</strong> ${authorResponse.accepted ? 'APROBADA' : 'RECHAZADA'}</p>
              ${authorResponse.comments ? `<p><strong>Comentarios:</strong> ${authorResponse.comments}</p>` : ''}
              <p>Accede al portal editorial para continuar con el proceso.</p>
            `
            : `
              <p>The author has responded to your metadata change proposal.</p>
              <p><strong>Article:</strong> ${afterData.title}</p>
              <p><strong>Response:</strong> ${authorResponse.accepted ? 'APPROVED' : 'REJECTED'}</p>
              ${authorResponse.comments ? `<p><strong>Comments:</strong> ${authorResponse.comments}</p>` : ''}
              <p>Access the editorial portal to continue the process.</p>
            `;
          
          const htmlBody = getEmailTemplate(
            emailSubject,
            isSpanish ? `Estimado/a ${task.assignedToName || 'Editor'}:` : `Dear ${task.assignedToName || 'Editor'}:`,
            emailBody,
            isSpanish ? 'Sistema Editorial' : 'Editorial System',
            isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
            isSpanish ? 'es' : 'en'
          );
          
          await sendEmailViaExtension(task.assignedToEmail, emailSubject, htmlBody);
          console.log(`✅ Notificación enviada a editor ${task.assignedToEmail}`);
        }
        
      } catch (error) {
        console.error('Error en onMetadataProposalResponse:', error);
        await logSystemError('onMetadataProposalResponse', error, { submissionId: event.params.submissionId });
      }
    }
  }
);
// Función auxiliar para enviar emails (completa)
async function sendEmailToEditor(editorEmail, eventType, submissionId) {
  const db = admin.firestore();
  const submissionSnap = await db.collection('submissions').doc(submissionId).get();
  if (!submissionSnap.exists) return;
  
  const submission = submissionSnap.data();
  const isSpanish = submission.paperLanguage === 'es';
  
  let subject, bodyContent;
  
  if (eventType === 'selection_complete') {
    subject = isSpanish 
      ? '✅ Selección de revisores completada' 
      : '✅ Reviewer selection completed';
    
    bodyContent = isSpanish
      ? `
        <p>Se han alcanzado las 2 aceptaciones de revisores necesarias para el artículo <strong>"${submission.title}"</strong>.</p>
        <p>El artículo ha pasado automáticamente a la fase de <strong>revisión por pares</strong>.</p>
        <p>Recibirá una notificación cuando los revisores completen sus evaluaciones.</p>
      `
      : `
        <p>2 reviewer acceptances have been reached for the article <strong>"${submission.title}"</strong>.</p>
        <p>The article has automatically moved to the <strong>peer review</strong> phase.</p>
        <p>You will be notified when the reviewers complete their evaluations.</p>
      `;
  }
  
  const htmlBody = getEmailTemplate(
    subject,
    isSpanish ? 'Estimado/a Editor:' : 'Dear Editor:',
    bodyContent,
    isSpanish ? 'Sistema Editorial' : 'Editorial System',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    isSpanish ? 'es' : 'en'
  );
  
  await sendEmailViaExtension(editorEmail, subject, htmlBody);
}

// ===================== AUTO CREATE NEXT ROUND ON REVISION - VERSIÓN FINAL CORREGIDA =====================
// ===================== AUTO CREATE NEXT ROUND ON REVISION - VERSIÓN CORREGIDA =====================
// REEMPLAZA la función existente con esta.
exports.onAuthorRevisionSubmitted = onDocumentCreated(
  {
    document: 'submissions/{submissionId}/versions/{versionId}',
    secrets: [],
    memory: '512MiB'
  },
  async (event) => {
    const versionData = event.data.data();
    const { submissionId, versionId } = event.params;

    // Solo procesar si es una revisión del autor (type = 'revision')
    if (versionData.type !== 'revision') {
      console.log(`⏭️ Versión ${versionId} no es una revisión de autor (type: ${versionData.type}). Saliendo.`);
      return;
    }

    console.log(`🔄 [onAuthorRevisionSubmitted] Nueva revisión detectada: ${versionId} para envío ${submissionId}`);

    try {
      const db = admin.firestore();
      const submissionRef = db.collection('submissions').doc(submissionId);
      const submissionSnap = await submissionRef.get();

      if (!submissionSnap.exists) {
        console.error(`❌ Submission no encontrado: ${submissionId}`);
        return;
      }

      const submissionData = submissionSnap.data();
      const currentRound = submissionData.currentRound || 1;
      const newRound = currentRound + 1;

      console.log(`🎯 Procesando revisión para ronda ${newRound} de ${submissionId}`);

      // ===== 1. PRESERVAR HISTORIAL DE LA RONDA ACTUAL =====
      const currentRoundHistoryRef = submissionRef.collection('roundHistory').doc(`round_${currentRound}`);
      const currentRoundData = {
        round: currentRound,
        deskReviewDecision: submissionData.deskReviewDecision || null,
        deskReviewFeedback: submissionData.deskReviewFeedback || '',
        deskReviewComments: submissionData.deskReviewComments || '',
        deskReviewCompletedAt: submissionData.deskReviewCompletedAt || null,
        finalDecision: submissionData.finalDecision || null,
        finalFeedback: submissionData.finalFeedback || '',
        finalCompletedAt: submissionData.finalCompletedAt || null,
        authorRevisionVersionId: versionId,
        authorRevisionSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        roundCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await currentRoundHistoryRef.set(currentRoundData, { merge: true });
      console.log(`✅ Historial de ronda ${currentRound} preservado antes de crear nueva ronda`);

      // ===== 2. BUSCAR LA TAREA PENDIENTE EN ESPERA DEL AUTOR (ronda anterior) =====
      const pendingTaskSnapshot = await db.collection('editorialTasks')
        .where('submissionId', '==', submissionId)
        .where('status', '==', 'awaiting-author-revision')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      let oldTaskId = null;
      let assignedTo, assignedToEmail, assignedToName;

      if (pendingTaskSnapshot.empty) {
        console.log(`⚠️ No se encontró tarea en espera. Buscando la última tarea para obtener editor...`);
        const lastTaskSnapshot = await db.collection('editorialTasks')
          .where('submissionId', '==', submissionId)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
          
        if (lastTaskSnapshot.empty) {
          console.error(`❌ No hay tareas previas para el envío ${submissionId}. No se puede asignar editor.`);
          return;
        }
        
        const lastTask = lastTaskSnapshot.docs[0].data();
        assignedTo = lastTask.assignedTo;
        assignedToEmail = lastTask.assignedToEmail;
        assignedToName = lastTask.assignedToName;
        oldTaskId = lastTaskSnapshot.docs[0].id;
      } else {
        const oldTask = pendingTaskSnapshot.docs[0];
        oldTaskId = oldTask.id;
        const oldTaskData = oldTask.data();
        assignedTo = oldTaskData.assignedTo;
        assignedToEmail = oldTaskData.assignedToEmail;
        assignedToName = oldTaskData.assignedToName;
      }

      // ===== 3. MARCAR LA TAREA ANTERIOR COMO COMPLETADA =====
      if (oldTaskId) {
        const oldTaskRef = db.collection('editorialTasks').doc(oldTaskId);
        
        // Guardar historial en la tarea anterior
        await oldTaskRef.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          nextTaskId: null, // Se actualizará después con el ID de la nueva tarea
          authorRevisionVersionId: versionId,
          authorRevisionSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
          roundCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Tarea anterior ${oldTaskId} marcada como completada.`);
      }

      // ===== 4. CREAR NUEVA TAREA EDITORIAL PARA LA NUEVA RONDA =====
      const newTaskData = {
        submissionId: submissionId,
        submissionTitle: submissionData.title || 'Sin título',
        round: newRound,
        status: 'desk-review-in-progress',
        assignedTo: assignedTo,
        assignedToEmail: assignedToEmail,
        assignedToName: assignedToName,
        assignedBy: assignedTo,
        assignmentNotes: `Nueva ronda ${newRound} generada automáticamente tras recibir revisión del autor.`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Inicializar contadores
        acceptedReviewers: 0,
        reviewsSubmitted: 0,
        reviewerIds: [],
        // Resetear campos de decisiones para la nueva ronda
        deskReviewDecision: null,
        deskReviewFeedback: '',
        deskReviewComments: '',
        deskReviewCompletedAt: null,
        finalDecision: null,
        finalFeedbackToAuthor: '',
        finalComments: '',
        finalCompletedAt: null
      };

      const newTaskRef = await db.collection('editorialTasks').add(newTaskData);
      const newTaskId = newTaskRef.id;
      console.log(`✅ Nueva tarea creada: ${newTaskId} para ronda ${newRound}`);

      // Actualizar la tarea anterior con el ID de la nueva (para trazabilidad)
      if (oldTaskId) {
        await db.collection('editorialTasks').doc(oldTaskId).update({
          nextTaskId: newTaskId
        });
      }

      // ===== 5. CREAR NUEVA REVISIÓN EDITORIAL VINCULADA A LA NUEVA TAREA =====
      const editorialReviewData = {
        submissionId: submissionId,
        round: newRound,
        status: 'pending',
        editorUid: assignedTo,
        editorEmail: assignedToEmail,
        editorName: assignedToName,
        editorialTaskId: newTaskId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const editorialReviewRef = await db.collection('editorialReviews').add(editorialReviewData);
      console.log(`✅ Nueva revisión editorial creada: ${editorialReviewRef.id} para tarea ${newTaskId}`);

      // ===== 6. ACTUALIZAR LA NUEVA TAREA CON EL ID DE LA REVIEW =====
      await newTaskRef.update({
        editorialReviewId: editorialReviewRef.id,
        currentReviewId: editorialReviewRef.id
      });

      // ===== 7. ACTUALIZAR EL SUBMISSION CON LAS NUEVAS REFERENCIAS =====
      // NO borramos las decisiones anteriores, solo las movemos al historial
      const submissionUpdateData = {
        currentRound: newRound,
        status: 'in-editorial-review',
        currentEditorialTaskId: newTaskId,
        currentEditorialReviewId: editorialReviewRef.id,
        lastRevisionAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Limpiar SOLO los campos de la ronda actual para la nueva ronda
        // Las decisiones anteriores ya fueron guardadas en roundHistory
        deskReviewDecision: null,
        deskReviewFeedback: '',
        deskReviewComments: '',
        deskReviewCompletedAt: null,
        finalDecision: null,
        finalFeedback: '',
        finalComments: '',
        finalCompletedAt: null,
        decisionMadeAt: null,
        decisionMadeBy: null
      };
      
      await submissionRef.update(submissionUpdateData);
      console.log(`✅ Submission actualizado para ronda ${newRound}`);

      // ===== 8. REGISTRAR EN AUDIT LOG =====
      await submissionRef.collection('auditLogs').add({
        action: 'new_round_created_with_new_task',
        round: newRound,
        details: `Ronda ${newRound} creada con nueva tarea ${newTaskId} y revisión ${editorialReviewRef.id}`,
        oldTaskId: oldTaskId,
        newTaskId: newTaskId,
        editorialReviewId: editorialReviewRef.id,
        versionId: versionId,
        assignedTo: assignedToEmail,
        previousRound: currentRound,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // ===== 9. ENVIAR NOTIFICACIÓN AL EDITOR =====
      await sendNewRoundNotificationToEditor(
        submissionData,
        { ...newTaskData, id: newTaskId },
        editorialReviewRef.id,
        versionData,
        newRound
      );

      console.log(`🎉 Ronda ${newRound} creada exitosamente para ${submissionId} (nueva tarea: ${newTaskId})`);

    } catch (error) {
      console.error(`❌ Error en onAuthorRevisionSubmitted:`, error.message);
      console.error(error.stack);
      await logSystemError('onAuthorRevisionSubmitted', error, { 
        submissionId, 
        versionId,
        versionData: {
          type: versionData?.type,
          version: versionData?.version
        }
      });
    }
  }
);
/* ===================== NOTIFICACIÓN AL EDITOR DE NUEVA RONDA - VERSIÓN MEJORADA ===================== */
async function sendNewRoundNotificationToEditor(submission, task, editorialReviewId, version, round) {
  try {
    const db = admin.firestore();
    const isSpanish = submission.paperLanguage === 'es';
    const baseUrl = 'https://www.revistacienciasestudiantes.com';
    
    // Obtener el nombre del artículo de manera segura
    const articleTitle = submission.title || submission.submissionId || 'Artículo sin título';
    
    const emailTitle = isSpanish
      ? `📬 Nueva ronda de revisión: "${articleTitle.substring(0, 60)}${articleTitle.length > 60 ? '...' : ''}"`
      : `📬 New review round: "${articleTitle.substring(0, 60)}${articleTitle.length > 60 ? '...' : ''}"`;

    const emailGreeting = isSpanish
      ? `Estimado/a ${task.assignedToName || 'Editor/a'}:`
      : `Dear ${task.assignedToName || 'Editor'}:`;

    const submissionDate = version.uploadedAt?.toDate 
      ? version.uploadedAt.toDate().toLocaleString(isSpanish ? 'es-CL' : 'en-US')
      : 'Fecha no disponible';

    // Construir el enlace correcto usando el editorialReviewId
    const reviewLink = `${baseUrl}/${isSpanish ? 'es' : 'en'}/editorial/review/${editorialReviewId}`;

    const bodyContent = isSpanish
      ? `
        <p>El autor ha enviado una <strong>nueva versión revisada</strong> del artículo <strong>"${articleTitle}"</strong>.</p>

        <div class="highlight-box">
          <p class="article-title">"${articleTitle}"</p>
          <p><strong>ID del envío:</strong> ${submission.submissionId}</p>
          <p><strong>Ronda actual:</strong> ${round}</p>
          <p><strong>Área:</strong> ${submission.area || 'No especificada'}</p>
          <p><strong>Autor/a:</strong> ${submission.authorName || 'Autor'} (${submission.authorEmail || 'Email no disponible'})</p>
        </div>

        <h3>📄 Detalles de la nueva versión:</h3>
        <div style="background-color: #f0f7ff; padding: 15px; border-left: 4px solid #0A1929; border-radius: 4px;">
          <p><strong>Archivo:</strong> <a href="${version.fileUrl || '#'}">${version.fileName || 'Documento'}</a></p>
          <p><strong>Fecha de envío:</strong> ${submissionDate}</p>
          ${version.notes ? `<p><strong>Notas del autor:</strong><br>${version.notes.replace(/\n/g, '<br>')}</p>` : ''}
        </div>

        <h3>🔍 Próximos pasos:</h3>
        <ol>
          <li><strong>Revisión editorial inicial:</strong> Evalúa si el autor abordó adecuadamente los comentarios de la ronda anterior.</li>
          <li><strong>Decisión:</strong> Puedes:
            <ul>
              <li>Aceptar el artículo si está listo.</li>
              <li>Solicitar otra ronda de revisiones.</li>
              <li>Enviar a revisión por pares nuevamente.</li>
            </ul>
          </li>
        </ol>

        <div class="button-container">
          <a href="${reviewLink}" class="btn">INICIAR REVISIÓN EDITORIAL</a>
          <a href="${version.fileUrl || '#'}" class="btn btn-secondary">VER NUEVA VERSIÓN</a>
        </div>
      `
      : `
        <p>The author has submitted a <strong>new revised version</strong> of the article <strong>"${articleTitle}"</strong>.</p>

        <div class="highlight-box">
          <p class="article-title">"${articleTitle}"</p>
          <p><strong>Submission ID:</strong> ${submission.submissionId}</p>
          <p><strong>Current round:</strong> ${round}</p>
          <p><strong>Area:</strong> ${submission.area || 'Not specified'}</p>
          <p><strong>Author:</strong> ${submission.authorName || 'Author'} (${submission.authorEmail || 'Email not available'})</p>
        </div>

        <h3>📄 New version details:</h3>
        <div style="background-color: #f0f7ff; padding: 15px; border-left: 4px solid #0A1929; border-radius: 4px;">
          <p><strong>File:</strong> <a href="${version.fileUrl || '#'}">${version.fileName || 'Document'}</a></p>
          <p><strong>Submission date:</strong> ${submissionDate}</p>
          ${version.notes ? `<p><strong>Author's notes:</strong><br>${version.notes.replace(/\n/g, '<br>')}</p>` : ''}
        </div>

        <h3>🔍 Next steps:</h3>
        <ol>
          <li><strong>Initial editorial review:</strong> Assess whether the author adequately addressed the previous round's comments.</li>
          <li><strong>Decision:</strong> You can:
            <ul>
              <li>Accept the article if ready.</li>
              <li>Request another revision round.</li>
              <li>Send to peer review again.</li>
            </ul>
          </li>
        </ol>

        <div class="button-container">
          <a href="${reviewLink}" class="btn">START EDITORIAL REVIEW</a>
          <a href="${version.fileUrl || '#'}" class="btn btn-secondary">VIEW NEW VERSION</a>
        </div>
      `;

    const htmlBody = getEmailTemplate(
      emailTitle,
      emailGreeting,
      bodyContent,
      isSpanish ? 'Sistema Automático' : 'Automatic System',
      isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
      isSpanish ? 'es' : 'en'
    );

    await sendEmailViaExtension(task.assignedToEmail, emailTitle, htmlBody);
    console.log(`✅ Notificación de nueva ronda enviada a editor: ${task.assignedToEmail}`);

    // Registrar envío
    await db.collection('submissions').doc(submission.submissionId)
      .collection('auditLogs').add({
        action: 'editor_notified_new_round',
        round: round,
        editorEmail: task.assignedToEmail,
        editorialReviewId: editorialReviewId,
        taskId: task.id,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

  } catch (error) {
    console.error(`❌ Error enviando notificación de nueva ronda:`, error.message);
    console.error(error.stack);
    await logSystemError('sendNewRoundNotificationToEditor', error, {
      submissionId: submission?.submissionId,
      round
    });
  }
}
/* ===================== PREPARAR PARA SIGUIENTE RONDA ===================== */
/**
 * TRIGGER: Cuando una editorialReview se actualiza con decisión 'revision-required' o 'minor-revision'
 * Prepara el submission para recibir la revisión del autor
 */
/* ===================== ON EDITORIAL REVIEW CREATED - ACTUALIZADO ===================== */
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

      await submissionRef.update({
        status: 'in-editorial-review',
        currentEditorialReviewId: reviewId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Si hay una tarea asociada, actualizarla
      if (reviewData.editorialTaskId) {
        const taskRef = db.collection('editorialTasks').doc(reviewData.editorialTaskId);
        await taskRef.update({
          status: 'in-progress',
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          currentReviewId: reviewId,
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


/* ===================== FUNCIÓN ACTUALIZADA: onArticleReadyForPublication ===================== */
/**
 * TRIGGER: Cuando un artículo es marcado como listo para publicación,
 * genera automáticamente el certificado de aceptación
 */
exports.onArticleReadyForPublication = onDocumentUpdated(
  {
    document: 'submissions/{submissionId}',
    secrets: [OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN],
    memory: '512MiB',
    timeoutSeconds: 540
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const submissionId = event.params.submissionId;

    // Solo proceder si publicationReady cambió de false a true
    if (beforeData.publicationReady === afterData.publicationReady || afterData.publicationReady !== true) {
      return;
    }

    console.log(`📢 [onArticleReadyForPublication] Artículo ${submissionId} marcado como listo para publicación.`);
    
    const db = admin.firestore();
    const submissionRef = db.collection('submissions').doc(submissionId);
    
    try {
      // ============ PASO 1: CONSOLIDACIÓN DE METADATOS ============
      console.log(`[${submissionId}] 📦 Consolidando metadatos finales...`);
      
      const metadataFields = [
        'title', 'titleEn', 'abstract', 'abstractEn', 
        'keywords', 'keywordsEn', 'authors', 'funding', 
        'conflictOfInterest', 'dataAvailability', 'dataAvailabilityEn',
        'acknowledgments', 'area', 'articleType'
      ];
      
      // Extraer metadatos actuales
      const baseMetadata = {};
      metadataFields.forEach(field => {
        if (afterData[field] !== undefined) {
          baseMetadata[field] = afterData[field];
        }
      });
      
      // Obtener propuestas de metadatos aprobadas
      const proposalsSnapshot = await db.collection('submissions')
        .doc(submissionId)
        .collection('metadataProposals')
        .where('status', '==', 'approved')
        .orderBy('proposedAt', 'desc')
        .get();
      
      // Aplicar propuestas aprobadas (más recientes tienen prioridad)
      let finalMetadata = { ...baseMetadata };
      const updatedFields = new Set();
      
      proposalsSnapshot.forEach(doc => {
        const proposal = doc.data();
        if (proposal.changes && Array.isArray(proposal.changes)) {
          proposal.changes.forEach(change => {
            const field = change.field;
            if (!updatedFields.has(field)) {
              finalMetadata[field] = change.proposedValue;
              updatedFields.add(field);
            }
          });
        }
      });
      
      // Guardar metadatos consolidados
      await submissionRef.update({
        metadataBeforeConsolidation: baseMetadata,
        currentMetadata: finalMetadata,
        ...finalMetadata,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`[${submissionId}] ✅ Metadatos consolidados:`, Object.keys(finalMetadata));
      
      // ============ PASO 2: GENERAR CERTIFICADO ============
      console.log(`[${submissionId}] 🏆 Generando certificado de aceptación...`);
      
      try {
        // Obtener datos completos del submission actualizado
        const updatedDoc = await submissionRef.get();
        const updatedSubmission = {
          ...updatedDoc.data(),
          submissionId: submissionId
        };
        
        // Generar certificado con metadata final
        const certificateResult = await generateAcceptanceCertificate(
          updatedSubmission,
          {
            acceptanceDate: afterData.publicationReadyAt?.toDate?.() || new Date()
          }
        );
        
        console.log(`[${submissionId}] ✅ Certificado generado: ${certificateResult.certificateNumber}`);
        console.log(`[${submissionId}] 🔗 URL: ${certificateResult.certificateUrl}`);
        
      } catch (certError) {
        console.error(`[${submissionId}] ❌ Error generando certificado:`, certError.message);
        // No interrumpir el flujo si falla el certificado
        // Pero registrar el error
        await db.collection('submissions').doc(submissionId)
          .collection('auditLogs').add({
            action: 'certificate_generation_failed',
            error: certError.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
      }
      
      // ============ PASO 3: NOTIFICAR A DIRECTORES ============
      console.log(`[${submissionId}] 📧 Notificando a directores generales...`);
      
      // Obtener emails de directores generales
      const directorsSnapshot = await db.collection('users')
        .where('roles', 'array-contains', 'Director General')
        .get();
      
      const directorEmails = [];
      directorsSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          directorEmails.push({
            email: userData.email,
            name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Director'
          });
        }
      });
      
      // Fallback si no hay directores
      if (directorEmails.length === 0) {
        directorEmails.push({ 
          email: 'contact@revistacienciasestudiantes.com', 
          name: 'Director General' 
        });
      }
      
      const isSpanish = (finalMetadata.language || afterData.paperLanguage || 'es') === 'es';
      
      // Enviar email a cada director
      for (const director of directorEmails) {
        const emailTitle = isSpanish
          ? `✅ Artículo listo para publicación - "${finalMetadata.title || afterData.title}"`
          : `✅ Article ready for publication - "${finalMetadata.titleEn || finalMetadata.title || afterData.title}"`;
        
        const bodyContent = isSpanish
          ? `
            <p>El artículo <strong>"${finalMetadata.title || afterData.title}"</strong> ha sido marcado como <strong>listo para publicación</strong> por el equipo editorial.</p>
            
            <div style="background: #f5f7f9; padding: 15px; border-left: 4px solid #003B5C; margin: 20px 0;">
              <p><strong>ID del envío:</strong> ${submissionId}</p>
              <p><strong>Autor/a:</strong> ${afterData.authorName || 'N/A'}</p>
              <p><strong>Certificado generado:</strong> ${afterData.certificate?.fileUrl ? '✅ Sí' : '❌ No'}</p>
            </div>
            
            <h3>📄 Metadatos finales consolidados:</h3>
            <ul>
              <li><strong>Título:</strong> ${finalMetadata.title || 'N/A'}</li>
              <li><strong>Autores:</strong> ${finalMetadata.authors?.map(a => `${a.firstName} ${a.lastName}`).join('; ') || 'N/A'}</li>
              <li><strong>Área:</strong> ${finalMetadata.area || 'N/A'}</li>
            </ul>
            
            <h3>🔍 Acciones requeridas:</h3>
            <ol>
              <li>Revisar los metadatos finales del artículo.</li>
              <li>Verificar que el certificado se haya generado correctamente.</li>
              <li>Proceder con la maquetación y asignación de DOI.</li>
              <li>Programar la publicación en el próximo número/volumen.</li>
            </ol>
          `
          : `
            <p>The article <strong>"${finalMetadata.titleEn || finalMetadata.title || afterData.title}"</strong> has been marked as <strong>ready for publication</strong> by the editorial team.</p>
            
            <div style="background: #f5f7f9; padding: 15px; border-left: 4px solid #003B5C; margin: 20px 0;">
              <p><strong>Submission ID:</strong> ${submissionId}</p>
              <p><strong>Author:</strong> ${afterData.authorName || 'N/A'}</p>
              <p><strong>Certificate generated:</strong> ${afterData.certificate?.fileUrl ? '✅ Yes' : '❌ No'}</p>
            </div>
            
            <h3>📄 Final consolidated metadata:</h3>
            <ul>
              <li><strong>Title:</strong> ${finalMetadata.titleEn || finalMetadata.title || 'N/A'}</li>
              <li><strong>Authors:</strong> ${finalMetadata.authors?.map(a => `${a.firstName} ${a.lastName}`).join('; ') || 'N/A'}</li>
              <li><strong>Area:</strong> ${finalMetadata.area || 'N/A'}</li>
            </ul>
            
            <h3>🔍 Required actions:</h3>
            <ol>
              <li>Review the final article metadata.</li>
              <li>Verify the certificate was generated correctly.</li>
              <li>Proceed with layout and DOI assignment.</li>
              <li>Schedule publication in the next issue/volume.</li>
            </ol>
          `;
        
        const htmlBody = getEmailTemplate(
          emailTitle,
          isSpanish ? `Estimado/a ${director.name}:` : `Dear ${director.name}:`,
          bodyContent,
          isSpanish ? 'Sistema Editorial' : 'Editorial System',
          isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
          isSpanish ? 'es' : 'en'
        );
        
        await sendEmailViaExtension(
          director.email,
          emailTitle,
          htmlBody
        );
      }
      
      console.log(`[${submissionId}] ✅ Emails enviados a ${directorEmails.length} directores`);
      
      // ============ PASO 4: REGISTRAR EN AUDIT LOG ============
      await db.collection('submissions').doc(submissionId)
        .collection('auditLogs').add({
          action: 'publication_ready_complete',
          metadataConsolidated: true,
          certificateGenerated: afterData.certificate?.fileUrl ? true : false,
          directorsNotified: directorEmails.map(d => d.email),
          by: 'system',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      
      console.log(`[${submissionId}] ✅ Flujo de publicación completado`);
      
    } catch (error) {
      console.error(`[${submissionId}] ❌ Error en flujo de publicación:`, error.message);
      
      // Registrar error en audit log
      await db.collection('submissions').doc(submissionId)
        .collection('auditLogs').add({
          action: 'publication_ready_error',
          error: error.message,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      
      throw error;
    }
  }
);
// ===================== ON REVIEW SUBMITTED - VERSIÓN CORREGIDA (Usa Subcolección) =====================
// REEMPLAZA la función existente con esta.
exports.onReviewerAssignmentSubmittedUpdateSubmission = onDocumentUpdated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [],
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const assignmentId = event.params.assignmentId;

    // Solo cuando CAMBIA a 'submitted' (primera vez que se envía)
    if (beforeData.status === afterData.status || afterData.status !== 'submitted') {
      return;
    }

    console.log(`📝 [onReviewerAssignmentSubmittedUpdateSubmission] Revisión completada: ${assignmentId}`);

    try {
      const db = admin.firestore();
      
      const assignment = afterData;
      const submissionId = assignment.submissionId;
      
      if (!submissionId) {
        console.error('❌ No submissionId en assignment');
        return;
      }

      // Construir objeto ANÓNIMO para el autor
      const anonymousReview = {
        commentsToAuthor: assignment.commentsToAuthor || '',
        recommendation: assignment.recommendation || '',
        scores: assignment.scores || {},
        submittedAt: assignment.submittedAt || admin.firestore.FieldValue.serverTimestamp(),
        round: assignment.round || 1
        // EXPLÍCITAMENTE SIN DATOS DEL REVISOR
      };

      // Guardar la reseña como un documento en la subcolección 'reviews'
      const reviewsCollectionRef = db.collection('submissions').doc(submissionId).collection('reviews');
      await reviewsCollectionRef.add({
        ...anonymousReview,
        // Podemos añadir un hash o metadato para evitar duplicados por error, pero la creación del doc ya es única.
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Revisión guardada en subcolección para submission ${submissionId}`);

      // Registrar en audit log
      await db.collection('submissions').doc(submissionId)
        .collection('auditLogs').add({
          action: 'review_added_to_submission',
          assignmentId: assignmentId,
          reviewerEmail: assignment.reviewerEmail, // Solo para log interno
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
      console.error(`❌ Error:`, error.message);
      console.error(error.stack);
      await logSystemError('onReviewerAssignmentSubmittedUpdateSubmission', error, { 
        assignmentId
      });
    }
  }
);
// ===================== GET USER INVITATIONS (VERSIÓN MEJORADA) =====================
exports.getUserInvitations = onCall(
  {
    secrets: [], // No necesita secrets adicionales
    memory: '256MiB'
  },
  async (request) => {
    const { HttpsError } = require("firebase-functions/v2/https");
    
    // --- LOG 1: Inicio de la función ---
    console.log('📥 [getUserInvitations] Función invocada');
    console.log('📥 Auth UID recibido:', request.auth?.uid);
    
    try {
      if (!request.auth) {
        console.error('❌ [getUserInvitations] No authenticated');
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
      }
      
      const uid = request.auth.uid;
      const db = admin.firestore();
      
      // --- LOG 2: Buscando usuario por UID ---
      console.log(`🔍 [getUserInvitations] Buscando usuario con UID: ${uid}`);
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        // --- LOG 3: Usuario NO encontrado por UID ---
        console.error(`❌ [getUserInvitations] Usuario NO encontrado con UID: ${uid}`);
        
        // 🚨 NUEVO: Intentar buscar por email como fallback
        console.log(`🔍 [getUserInvitations] Buscando usuario por email usando el token...`);
        
        // Obtener el email del token decodificado
        const userFromAuth = await admin.auth().getUser(uid);
        const userEmail = userFromAuth.email;
        
        if (userEmail) {
          console.log(`🔍 [getUserInvitations] Buscando en Firestore por email: ${userEmail}`);
          const userQuery = await db.collection('users')
            .where('email', '==', userEmail)
            .limit(1)
            .get();
          
          if (!userQuery.empty) {
            const foundUser = userQuery.docs[0];
            console.log(`✅ [getUserInvitations] Usuario encontrado por email con ID: ${foundUser.id}`);
            
            // Usar este documento para continuar
            const userData = foundUser.data();
            // ... (resto del código usando userData)
          } else {
            console.error(`❌ [getUserInvitations] Usuario tampoco encontrado por email: ${userEmail}`);
            throw new HttpsError('not-found', 'Usuario no encontrado en Firestore');
          }
        } else {
          throw new HttpsError('not-found', 'Usuario no encontrado en Firestore');
        }
      }
      
      // Si llegamos aquí, tenemos el userDoc
      const userData = userDoc.data();
      console.log('✅ [getUserInvitations] Usuario encontrado. Email:', userData?.email);
      
      const userEmail = userData.email;
      if (!userEmail) {
        console.error('❌ [getUserInvitations] Usuario sin email en Firestore');
        throw new HttpsError('failed-precondition', 'Usuario sin email');
      }
      
      // --- LOG 4: Buscando invitaciones ---
      console.log(`🔍 [getUserInvitations] Buscando invitaciones para email: ${userEmail}`);
      
      const invitationsSnapshot = await db.collection('reviewerInvitations')
        .where('reviewerEmail', '==', userEmail)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();
      
      console.log(`📊 [getUserInvitations] Invitaciones encontradas: ${invitationsSnapshot.size}`);
      
      const invitations = [];
      const submissionsMap = {};
      
      for (const doc of invitationsSnapshot.docs) {
        const data = doc.data();
        console.log(`   - Invitación ID: ${doc.id}, Submission: ${data.submissionId}`);
        
        invitations.push({
          id: doc.id,
          submissionId: data.submissionId,
          reviewerName: data.reviewerName,
          invitedBy: data.invitedBy,
          invitedByEmail: data.invitedByEmail,
          round: data.round,
          createdAt: data.createdAt?.toDate?.()?.toISOString(),
          inviteHash: data.inviteHash,
          responseLink: `https://www.revistacienciasestudiantes.com/reviewer-response?hash=${data.inviteHash}`
        });
        
        submissionsMap[data.submissionId] = null;
      }
      
      // --- LOG 5: Obteniendo detalles de submissions ---
      console.log(`🔍 [getUserInvitations] Obteniendo detalles de ${Object.keys(submissionsMap).length} submissions`);
      
      for (const subId of Object.keys(submissionsMap)) {
        const subDoc = await db.collection('submissions').doc(subId).get();
        if (subDoc.exists) {
          submissionsMap[subId] = {
            title: subDoc.data().title,
            area: subDoc.data().area
          };
          console.log(`   - Submission ${subId}: ${subDoc.data().title}`);
        } else {
          console.warn(`   ⚠️ Submission no encontrado: ${subId}`);
          submissionsMap[subId] = { title: 'Artículo no encontrado' };
        }
      }
      
      const result = invitations.map(inv => ({
        ...inv,
        submission: submissionsMap[inv.submissionId] || { title: 'Artículo no encontrado' }
      }));
      
      console.log(`✅ [getUserInvitations] Éxito. Devolviendo ${result.length} invitaciones`);
      
      return {
        success: true,
        invitations: result,
        count: result.length
      };
      
    } catch (error) {
      // --- LOG 6: Error capturado ---
      console.error('❌ [getUserInvitations] Error:', error.message);
      console.error('❌ Stack:', error.stack);
      
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message);
    }
  }
);
exports.manageCollectionArticles = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true,
    timeoutSeconds: 120
  },
  async (req, res) => {
    // Configuración CORS (misma que en las otras funciones)
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Verificar autenticación
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const token = authHeader.split("Bearer ")[1];
      const user = await admin.auth().verifyIdToken(token);
      
      await validateRole(user.uid, "Director General");

      const { action, collection, article, id } = req.body;
      
      if (!action || !collection) {
        return res.status(400).json({ error: "Acción y colección requeridas" });
      }

      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "revista1919.github.io";
      const METADATA_PATH = `collections/${collection}/metadata.json`;
      const BRANCH = "main";

      // Validar estructura del artículo
      function validateArticle(article) {
        const required = ['id', 'name', 'author', 'date'];
        const missing = required.filter(field => !article[field]);
        
        if (missing.length > 0) {
          throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
        }

        // Validar estructura multilingüe básica
        if (!article.name?.spanish) {
          throw new Error('El campo name.spanish es requerido');
        }

        if (!Array.isArray(article.author) || article.author.length === 0) {
          throw new Error('Debe haber al menos un autor');
        }

        return true;
      }

      // Obtener metadata.json actual
      async function getCurrentMetadata() {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: METADATA_PATH,
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

      async function saveMetadata(articles, sha, commitMessage) {
        const content = Buffer.from(JSON.stringify(articles, null, 2)).toString('base64');
        
        if (sha) {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: METADATA_PATH,
            message: commitMessage,
            content: content,
            sha: sha,
            branch: BRANCH
          });
        } else {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: METADATA_PATH,
            message: commitMessage,
            content: content,
            branch: BRANCH
          });
        }
      }

      const { articles: currentArticles, sha } = await getCurrentMetadata();
      let updatedArticles = [...currentArticles];
      let responseData = {};

      // ADD: Agregar artículo
      if (action === "add") {
        try {
          validateArticle(article);
        } catch (validationError) {
          return res.status(400).json({ error: validationError.message });
        }

        // Verificar si ya existe
        if (currentArticles.some(a => a.id === article.id)) {
          return res.status(400).json({ error: "Ya existe un artículo con este ID" });
        }

        const newArticle = {
          ...article,
          metadata: {
            createdAt: new Date().toISOString(),
            createdBy: user.uid,
            createdByEmail: user.email || null,
            version: "1.0.0"
          }
        };

        updatedArticles.push(newArticle);

        responseData = {
          success: true,
          id: article.id,
          message: "Artículo agregado exitosamente"
        };
      }

      // EDIT: Editar artículo
      if (action === "edit") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const index = updatedArticles.findIndex(a => a.id === id);
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        // Preservar metadatos de creación y agregar metadatos de edición
        const updatedArticle = {
          ...updatedArticles[index],
          ...article,
          metadata: {
            ...(updatedArticles[index].metadata || {}),
            ...article.metadata,
            updatedAt: new Date().toISOString(),
            updatedBy: user.uid,
            updatedByEmail: user.email || null,
            updateCount: (updatedArticles[index].metadata?.updateCount || 0) + 1
          }
        };

        updatedArticles[index] = updatedArticle;

        responseData = {
          success: true,
          id: id,
          message: "Artículo actualizado exitosamente"
        };
      }

      // DELETE: Eliminar artículo
      if (action === "delete") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const index = updatedArticles.findIndex(a => a.id === id);
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        updatedArticles.splice(index, 1);

        responseData = {
          success: true,
          id: id,
          message: "Artículo eliminado exitosamente"
        };
      }

      if (["add", "edit", "delete"].includes(action)) {
        await saveMetadata(
          updatedArticles,
          sha,
          `[${action}] Artículo ${action === 'add' ? 'agregado' : action === 'edit' ? 'actualizado' : 'eliminado'} en colección ${collection} por ${user.email || user.uid}`
        );

        // Trigger rebuild del sitio estático
        try {
          await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
            owner: "revista1919",
            repo: "revista1919.github.io",
            event_type: "rebuild-site",
            client_payload: {
              action: action,
              collection: collection,
              articleId: id || article?.id,
              articleTitle: article?.name?.spanish || article?.['name-original'],
              triggeredBy: user.uid,
              triggeredByEmail: user.email,
              timestamp: new Date().toISOString()
            }
          });
          
          console.log(`[${requestId}] Rebuild triggered successfully`);
        } catch (rebuildError) {
          console.error(`[${requestId}] Error triggering rebuild:`, rebuildError);
          // No fallamos la petición principal si el rebuild falla
        }

        return res.json({
          ...responseData,
          rebuildTriggered: true
        });
      }

      return res.status(400).json({ error: "Acción inválida" });

    } catch (err) {
      console.error(`[${requestId}] Error:`, err);
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message,
        requestId: requestId
      });
    }
  }
);
// manageCollections.js (Cloud Function) - VERSIÓN CORREGIDA
exports.manageCollections = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true,
    timeoutSeconds: 120
  },
  async (req, res) => {
    // Configuración CORS (igual que en manageArticles)
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

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] 🚀 manageCollections - Iniciando`);

    try {
      // Verificar autenticación
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const token = authHeader.split("Bearer ")[1];
      const user = await admin.auth().verifyIdToken(token);
      
      // Verificar rol
      await validateRole(user.uid, "Director General");

      const { action, collection, id } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: "Acción requerida" });
      }

      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "revista1919.github.io";
      const COLLECTIONS_JSON_PATH = "collections/collections.json";
      const BRANCH = "main";

      // 🔍 FUNCIÓN DE VALIDACIÓN DE ESTRUCTURA MULTILINGÜE
      function validateCollection(collection) {
        // Campos requeridos
        if (!collection.id) {
          throw new Error('El campo id es requerido');
        }

        // Validar título multilingüe
        if (!collection.title || typeof collection.title !== 'object') {
          throw new Error('El campo title debe ser un objeto con idiomas');
        }
        if (!collection.title.spanish && !collection.title.english) {
          throw new Error('Debe haber al menos un idioma en title (spanish o english)');
        }

        // Validar descripción multilingüe
        if (!collection.description || typeof collection.description !== 'object') {
          throw new Error('El campo description debe ser un objeto con idiomas');
        }
        if (!collection.description.spanish && !collection.description.english) {
          throw new Error('Debe haber al menos un idioma en description (spanish o english)');
        }

        // Validar carpet-name
        if (!collection['carpet-name']) {
          throw new Error('El campo carpet-name es requerido');
        }

        // Validar idiomas soportados
        if (!Array.isArray(collection.languages) || collection.languages.length === 0) {
          throw new Error('El campo languages debe ser un array con al menos un idioma');
        }

        // Validar idioma por defecto
        if (!collection.defaultLanguage) {
          throw new Error('El campo defaultLanguage es requerido');
        }
        if (!collection.languages.includes(collection.defaultLanguage)) {
          throw new Error('defaultLanguage debe estar incluido en languages');
        }

        // Validar status
        const validStatuses = ['active', 'inactive', 'archived'];
        if (collection.status && !validStatuses.includes(collection.status)) {
          throw new Error(`status debe ser uno de: ${validStatuses.join(', ')}`);
        }

        return true;
      }

      // Obtener collections.json actual
      async function getCurrentCollectionsJson() {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: COLLECTIONS_JSON_PATH,
            ref: BRANCH
          });
          
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          return {
            collections: JSON.parse(content),
            sha: data.sha
          };
        } catch (error) {
          if (error.status === 404) {
            return {
              collections: [],
              sha: null
            };
          }
          throw error;
        }
      }

      async function saveCollectionsJson(collections, sha, commitMessage) {
        const content = Buffer.from(JSON.stringify(collections, null, 2)).toString('base64');
        
        if (sha) {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: COLLECTIONS_JSON_PATH,
            message: commitMessage,
            content: content,
            sha: sha,
            branch: BRANCH
          });
        } else {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: COLLECTIONS_JSON_PATH,
            message: commitMessage,
            content: content,
            branch: BRANCH
          });
        }
      }

      // 📝 Crear archivos base de la colección con soporte multilingüe
      async function createCollectionFiles(carpetName, collectionData) {
        // Generador mejorado con soporte multilingüe
        const generateJsContent = `// Generador para la colección: ${collectionData.title.spanish || collectionData.title.english}
const fs = require('fs');
const path = require('path');

async function generateCollection() {
  try {
    // Leer metadata de artículos
    const metadataPath = path.join(__dirname, 'metadata.json');
    const articles = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    // Configuración de la colección
    const collectionConfig = {
      id: "${collectionData.id}",
      title: ${JSON.stringify(collectionData.title, null, 2)},
      description: ${JSON.stringify(collectionData.description, null, 2)},
      languages: ${JSON.stringify(collectionData.languages)},
      defaultLanguage: "${collectionData.defaultLanguage}",
      image: "${collectionData.image || ''}",
      status: "${collectionData.status || 'active'}"
    };
    
    console.log(\`📚 Generando colección: \${collectionConfig.title[collectionConfig.defaultLanguage]}\`);
    console.log(\`📄 Artículos a procesar: \${articles.length}\`);
    console.log(\`🌐 Idiomas disponibles: \${collectionConfig.languages.join(', ')}\`);
    
    // Crear directorios necesarios
    const articlesDir = path.join(__dirname, 'articles');
    if (!fs.existsSync(articlesDir)) {
      fs.mkdirSync(articlesDir, { recursive: true });
    }
    
    // Directorios por idioma
    collectionConfig.languages.forEach(lang => {
      const langDir = path.join(articlesDir, lang);
      if (!fs.existsSync(langDir)) {
        fs.mkdirSync(langDir, { recursive: true });
      }
    });
    
    // Generar índice multilingüe
    collectionConfig.languages.forEach(lang => {
      const indexPath = path.join(__dirname, \`index.\${lang}.html\`);
      const articlesInLang = articles.filter(a => 
        !a.language || a.language === lang
      );
      
      const indexContent = \`<!DOCTYPE html>
<html lang="\${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${collectionConfig.title[lang] || collectionConfig.title[collectionConfig.defaultLanguage]}</title>
    <meta name="description" content="\${collectionConfig.description[lang] || collectionConfig.description[collectionConfig.defaultLanguage]}">
    <meta property="og:title" content="\${collectionConfig.title[lang] || collectionConfig.title[collectionConfig.defaultLanguage]}">
    <meta property="og:description" content="\${collectionConfig.description[lang] || collectionConfig.description[collectionConfig.defaultLanguage]}">
    \${collectionConfig.image ? \`<meta property="og:image" content="\${collectionConfig.image}">\` : ''}
    <link rel="stylesheet" href="/css/collection.css">
</head>
<body>
    <main class="collection">
        <header>
            <h1>\${collectionConfig.title[lang] || collectionConfig.title[collectionConfig.defaultLanguage]}</h1>
            <p class="description">\${collectionConfig.description[lang] || collectionConfig.description[collectionConfig.defaultLanguage]}</p>
        </header>
        
        <section class="articles">
            <h2>Artículos (\${articlesInLang.length})</h2>
            <ul>
                \${articlesInLang.map(article => {
                  const title = article.name?.[lang] || 
                               article.name?.spanish || 
                               article['name-original'] || 
                               'Sin título';
                  return \`
                    <li>
                        <a href="./articles/\${lang}/\${article.id}.html">\${title}</a>
                        \${article.author ? \`<span class="authors">por \${article.author.map(a => a.name).join(', ')}</span>\` : ''}
                    </li>
                  \`;
                }).join('')}
            </ul>
        </section>
        
        <footer>
            <div class="language-switcher">
                \${collectionConfig.languages.map(l => 
                  l === lang ? 
                    \`<span class="current">\${l}</span>\` : 
                    \`<a href="/collections/\${collectionConfig.id}/index.\${l}.html">\${l}</a>\`
                ).join(' | ')}
            </div>
        </footer>
    </main>
</body>
</html>\`;
      
      fs.writeFileSync(indexPath, indexContent);
      console.log(\`✅ Índice generado para idioma: \${lang}\`);
    });
    
    // Generar archivo de configuración para el generador
    const configPath = path.join(__dirname, 'collection.config.json');
    fs.writeFileSync(configPath, JSON.stringify(collectionConfig, null, 2));
    
    console.log('✅ Colección generada exitosamente');
    
  } catch (error) {
    console.error('❌ Error generando colección:', error);
    process.exit(1);
  }
}

generateCollection();`;

        const baseFiles = [
          {
            path: `collections/${carpetName}/metadata.json`,
            content: JSON.stringify([], null, 2),
            message: `Initialize metadata for collection ${carpetName}`
          },
          {
            path: `collections/${carpetName}/collection.config.json`,
            content: JSON.stringify({
              id: collectionData.id,
              title: collectionData.title,
              description: collectionData.description,
              languages: collectionData.languages,
              defaultLanguage: collectionData.defaultLanguage,
              image: collectionData.image || null,
              status: collectionData.status || 'active',
              createdAt: new Date().toISOString()
            }, null, 2),
            message: `Add collection config for ${carpetName}`
          },
          {
            path: `collections/${carpetName}/generate.js`,
            content: generateJsContent,
            message: `Add generate.js for collection ${carpetName}`
          }
        ];

        for (const file of baseFiles) {
          try {
            // Verificar si el archivo ya existe
            try {
              await octokit.repos.getContent({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: file.path,
                ref: BRANCH
              });
              // Si existe, no lo creamos de nuevo
              continue;
            } catch (error) {
              if (error.status !== 404) throw error;
            }

            // Crear archivo
            await octokit.repos.createOrUpdateFileContents({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: file.path,
              message: file.message,
              content: Buffer.from(file.content).toString('base64'),
              branch: BRANCH
            });
          } catch (error) {
            console.error(`Error creating file ${file.path}:`, error);
          }
        }

        // Crear directorios para artículos por idioma
        for (const lang of collectionData.languages) {
          try {
            await octokit.repos.createOrUpdateFileContents({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: `collections/${carpetName}/articles/${lang}/.gitkeep`,
              message: `Initialize articles directory for ${lang} in collection ${carpetName}`,
              content: Buffer.from('').toString('base64'),
              branch: BRANCH
            });
          } catch (error) {
            console.error(`Error creating ${lang} articles directory:`, error);
          }
        }

        // Crear directorio para PDFs por idioma
        try {
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `pdfs/${carpetName}/.gitkeep`,
            message: `Initialize PDF directory for collection ${carpetName}`,
            content: Buffer.from('').toString('base64'),
            branch: BRANCH
          });
        } catch (error) {
          console.error('Error creating PDF directory:', error);
        }
      }

      // Eliminar archivos de la colección
      async function deleteCollectionFiles(carpetName) {
        try {
          // Obtener todos los archivos de la colección
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: `collections/${carpetName}`,
            ref: BRANCH
          });

          // Eliminar cada archivo
          for (const file of data) {
            if (file.type === 'file') {
              await octokit.repos.deleteFile({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: file.path,
                message: `Delete collection file: ${file.path}`,
                sha: file.sha,
                branch: BRANCH
              });
            }
          }

          // Eliminar directorio de PDFs
          try {
            const { data: pdfData } = await octokit.repos.getContent({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: `pdfs/${carpetName}`,
              ref: BRANCH
            });

            for (const file of pdfData) {
              await octokit.repos.deleteFile({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: file.path,
                message: `Delete PDF file: ${file.path}`,
                sha: file.sha,
                branch: BRANCH
              });
            }
          } catch (error) {
            if (error.status !== 404) throw error;
          }
        } catch (error) {
          if (error.status !== 404) throw error;
        }
      }

      // Actualizar package.json
      async function updatePackageJson(carpetName, collectionData, action_type) {
        try {
          const { data } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: 'package.json',
            ref: BRANCH
          });

          const content = Buffer.from(data.content, 'base64').toString('utf8');
          const packageJson = JSON.parse(content);
          const sha = data.sha;

          if (action_type === 'add' || action_type === 'edit') {
            // Agregar scripts para la colección con soporte multilingüe
            packageJson.scripts = {
              ...packageJson.scripts,
              [`generate:${carpetName}`]: `node collections/${carpetName}/generate.js`,
              [`generate:${carpetName}:watch`]: `nodemon collections/${carpetName}/generate.js`,
              [`clean:${carpetName}`]: `rm -rf collections/${carpetName}/articles/*.html collections/${carpetName}/articles/*/*.html`,
              [`build:${carpetName}`]: `npm run clean:${carpetName} && npm run generate:${carpetName}`
            };

            // Actualizar scripts all
            const allGenerateScripts = Object.keys(packageJson.scripts)
              .filter(key => key.startsWith('generate:') && !key.includes('all') && !key.includes('watch'))
              .map(key => `npm run ${key}`)
              .join(' && ');

            const allWatchScripts = Object.keys(packageJson.scripts)
              .filter(key => key.includes('watch'))
              .map(key => `"npm:${key}"`)
              .join(', ');

            packageJson.scripts['generate:all'] = allGenerateScripts;
            packageJson.scripts['generate:all:watch'] = `concurrently ${allWatchScripts}`;
            packageJson.scripts['clean:all'] = Object.keys(packageJson.scripts)
              .filter(key => key.startsWith('clean:') && !key.includes('all'))
              .map(key => `npm run ${key}`)
              .join(' && ');
            packageJson.scripts['build:all'] = `npm run clean:all && npm run generate:all`;

          } else if (action_type === 'delete') {
            // Eliminar scripts de la colección
            delete packageJson.scripts[`generate:${carpetName}`];
            delete packageJson.scripts[`generate:${carpetName}:watch`];
            delete packageJson.scripts[`clean:${carpetName}`];
            delete packageJson.scripts[`build:${carpetName}`];

            // Actualizar scripts all
            const remainingGenerateScripts = Object.keys(packageJson.scripts)
              .filter(key => key.startsWith('generate:') && !key.includes('all') && !key.includes('watch'))
              .map(key => `npm run ${key}`)
              .join(' && ');

            const remainingWatchScripts = Object.keys(packageJson.scripts)
              .filter(key => key.includes('watch'))
              .map(key => `"npm:${key}"`)
              .join(', ');

            if (remainingGenerateScripts) {
              packageJson.scripts['generate:all'] = remainingGenerateScripts;
              packageJson.scripts['generate:all:watch'] = `concurrently ${remainingWatchScripts}`;
            } else {
              delete packageJson.scripts['generate:all'];
              delete packageJson.scripts['generate:all:watch'];
            }

            packageJson.scripts['clean:all'] = Object.keys(packageJson.scripts)
              .filter(key => key.startsWith('clean:') && !key.includes('all'))
              .map(key => `npm run ${key}`)
              .join(' && ') || 'echo "No hay colecciones para limpiar"';
            
            packageJson.scripts['build:all'] = `npm run clean:all && npm run generate:all`;
          }

          // Guardar package.json actualizado
          await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: 'package.json',
            message: `Update package.json for collection ${carpetName} (${action_type})`,
            content: Buffer.from(JSON.stringify(packageJson, null, 2)).toString('base64'),
            sha: sha,
            branch: BRANCH
          });

        } catch (error) {
          console.error('Error updating package.json:', error);
          throw error;
        }
      }

      const { collections: currentCollections, sha } = await getCurrentCollectionsJson();
      let updatedCollections = [...currentCollections];
      let responseData = {};

      // ADD: Agregar nueva colección
      if (action === "add") {
        try {
          validateCollection(collection);
        } catch (validationError) {
          return res.status(400).json({ error: validationError.message });
        }

        // Verificar si ya existe
        if (currentCollections.some(c => c.id === collection.id)) {
          return res.status(400).json({ error: "Ya existe una colección con este ID" });
        }

        // Usar carpet-name proporcionado o generarlo
        const carpetName = collection['carpet-name'] || generateSlug(collection.id);
        
        const newCollection = {
          ...collection,
          'carpet-name': carpetName,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          createdByEmail: user.email || null,
          status: collection.status || 'active'
        };

        updatedCollections.push(newCollection);

        // Crear archivos de la colección
        await createCollectionFiles(carpetName, newCollection);
        
        // Actualizar package.json
        await updatePackageJson(carpetName, newCollection, 'add');

        responseData = {
          success: true,
          id: collection.id,
          carpetName: carpetName,
          message: "Colección creada exitosamente"
        };
      }

      // EDIT: Editar colección
      if (action === "edit") {
        if (!id) {
          return res.status(400).json({ error: "ID de colección requerido" });
        }

        const index = updatedCollections.findIndex(c => c.id === id);
        if (index === -1) {
          return res.status(404).json({ error: "Colección no encontrada" });
        }

        // Validar datos actualizados
        try {
          validateCollection(collection);
        } catch (validationError) {
          return res.status(400).json({ error: validationError.message });
        }

        const oldCollection = updatedCollections[index];
        const carpetName = collection['carpet-name'] || oldCollection['carpet-name'];

        const updatedCollection = {
          ...oldCollection,
          ...collection,
          'carpet-name': carpetName,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
          updatedByEmail: user.email || null
        };

        updatedCollections[index] = updatedCollection;

        // Si cambió el nombre de la carpeta, necesitamos mover los archivos
        if (carpetName !== oldCollection['carpet-name']) {
          console.log(`⚠️ Nota: El nombre de carpeta cambió de ${oldCollection['carpet-name']} a ${carpetName}`);
          console.log('Se requiere migración manual de archivos');
        }

        responseData = {
          success: true,
          id: id,
          message: "Colección actualizada exitosamente"
        };
      }

      // DELETE: Eliminar colección
      if (action === "delete") {
        if (!id) {
          return res.status(400).json({ error: "ID de colección requerido" });
        }

        const index = updatedCollections.findIndex(c => c.id === id);
        if (index === -1) {
          return res.status(404).json({ error: "Colección no encontrada" });
        }

        const collectionToDelete = updatedCollections[index];
        
        // Eliminar archivos de la colección
        await deleteCollectionFiles(collectionToDelete['carpet-name']);
        
        // Actualizar package.json
        await updatePackageJson(collectionToDelete['carpet-name'], collectionToDelete, 'delete');

        updatedCollections.splice(index, 1);

        responseData = {
          success: true,
          id: id,
          message: "Colección eliminada exitosamente"
        };
      }

      // Guardar collections.json actualizado
      if (["add", "edit", "delete"].includes(action)) {
        updatedCollections.sort((a, b) => a.id.localeCompare(b.id));
        
        await saveCollectionsJson(
          updatedCollections, 
          sha, 
          `[${action}] Colección ${action === 'add' ? 'agregada' : action === 'edit' ? 'actualizada' : 'eliminada'} por ${user.email || user.uid}`
        );

        // Trigger rebuild
        try {
          await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
            owner: "revista1919",
            repo: "revista1919.github.io",
            event_type: "rebuild-collections",
            client_payload: {
              action: action,
              collectionId: id || collection?.id,
              triggeredBy: user.uid,
              triggeredByEmail: user.email,
              timestamp: new Date().toISOString()
            }
          });
        } catch (rebuildError) {
          console.error("Error triggering rebuild:", rebuildError);
        }

        return res.json(responseData);
      }

      return res.status(400).json({ error: "Acción inválida" });

    } catch (err) {
      console.error(`[${requestId}] Error:`, err);
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message,
        requestId: requestId
      });
    }
  }
);
// =====================================================
// OAI-PMH SERVER - VERSIÓN 100% COMPLETA Y BLINDADA
// Firebase Functions v2
// =====================================================
const ARTICLES_URL = 'https://www.revistacienciasestudiantes.com/articles.json';
const BASE_URL = 'https://www.revistacienciasestudiantes.com/oai';
const REPO_IDENTIFIER = 'revistacienciasestudiantes.com';
const ADMIN_EMAIL = 'contact@revistacienciasestudiantes.com';
const REPO_NAME = 'Revista Nacional de las Ciencias Estudiantes';
const EARLIEST_DATESTAMP = '2025-11-10';
const BATCH_SIZE = 50;
const CACHE_TTL = 5 * 60 * 1000;

// Caché
let cachedArticles = null;
let lastFetch = 0;
let dynamicFetch = null;

// =====================================================
// CARGA SEGURA DE FETCH
// =====================================================
async function ensureFetch() {
  if (dynamicFetch) return dynamicFetch;

  console.log('🔄 [OAI] Cargando fetch...');

  try {
    if (typeof fetch !== 'undefined') {
      dynamicFetch = fetch;
      console.log('✅ [OAI] Usando fetch nativo');
      return dynamicFetch;
    }

    if (typeof globalThis.fetch !== 'undefined') {
      dynamicFetch = globalThis.fetch;
      console.log('✅ [OAI] Usando fetch global');
      return dynamicFetch;
    }

    console.log('⚠️ [OAI] Cargando node-fetch...');
    const { default: nodeFetch } = await import('node-fetch');
    dynamicFetch = nodeFetch;
    console.log('✅ [OAI] node-fetch cargado');
    return dynamicFetch;
  } catch (e) {
    console.error('❌ [OAI] Error cargando fetch:', e.message);
    throw new Error('Fetch no disponible');
  }
}

// =====================================================
// UTILIDADES
// =====================================================
function escapeXml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function oaiIdentifier(numeroArticulo) {
  return `oai:${REPO_IDENTIFIER}:article/${numeroArticulo}`;
}

function generateSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSetSpecs(article) {
  const sets = [];
  if (article.area) sets.push(`area:${generateSlug(article.area)}`);
  if (article.tipo) sets.push(`tipo:${generateSlug(article.tipo)}`);
  if (article.volumen) {
    sets.push(`volumen:${article.volumen}`);
    if (article.numero) sets.push(`volumen:${article.volumen}:numero:${article.numero}`);
  }
  return sets;
}

function getArticleUrl(article) {
  const slug = generateSlug(article.titulo);
  return `https://www.revistacienciasestudiantes.com/articles/article-${slug}-${article.numeroArticulo}.html`;
}

function parseIdentifier(identifier) {
  const match = identifier?.match(/^oai:[^:]+:article\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

// =====================================================
// DUBLIN CORE - OPTIMIZADO PARA DIALNET
// =====================================================
// =====================================================
// DUBLIN CORE - OPTIMIZADO PARA DIALNET
// =====================================================
function articleToDublinCore(article) {
  const elements = [];
  
  // Títulos (con lang)
  elements.push(`<dc:title xml:lang="es">${escapeXml(article.titulo)}</dc:title>`);
  if (article.tituloEnglish) elements.push(`<dc:title xml:lang="en">${escapeXml(article.tituloEnglish)}</dc:title>`);
  
  // Autores
  if (Array.isArray(article.autores)) {
    for (const author of article.autores) {
      if (author?.name) elements.push(`<dc:creator>${escapeXml(author.name)}</dc:creator>`);
    }
  }
  
  // Keywords (por separado, con lang)
  if (Array.isArray(article.palabras_clave)) {
    for (const kw of article.palabras_clave) if (kw) elements.push(`<dc:subject xml:lang="es">${escapeXml(kw)}</dc:subject>`);
  }
  if (Array.isArray(article.keywords_english)) {
    for (const kw of article.keywords_english) if (kw) elements.push(`<dc:subject xml:lang="en">${escapeXml(kw)}</dc:subject>`);
  }
  
  // Resúmenes
  if (article.resumen) elements.push(`<dc:description xml:lang="es">${escapeXml(article.resumen)}</dc:description>`);
  if (article.abstract) elements.push(`<dc:description xml:lang="en">${escapeXml(article.abstract)}</dc:description>`);
  
  // Referencias (si existen)
  if (article.referencias) {
    const refsText = extractReferencesAsText(article.referencias);
    if (refsText) {
      elements.push(`<dc:description xml:lang="es">${escapeXml(refsText)}</dc:description>`);
    }
  }
  
  // ⚠️ FECHA - CRÍTICO PARA DIALNET
  // Dialnet espera YYYY-MM-DD o al menos YYYY
  if (article.fecha) {
    elements.push(`<dc:date>${escapeXml(article.fecha)}</dc:date>`);
  }
  
  // ⚠️ TIPOS - DIALNET ESPERA ESTOS DOS EXACTOS
  elements.push(`<dc:type>info:eu-repo/semantics/article</dc:type>`);
  elements.push(`<dc:type>info:eu-repo/semantics/publishedVersion</dc:type>`);
  
  // ⚠️ FORMATO PDF - IMPORTANTE PARA DIALNET
  elements.push(`<dc:format>application/pdf</dc:format>`);
  
  // ⚠️ IDENTIFICADOR DOI - VA PRIMERO Y JUSTO ANTES DEL SOURCE
  if (article.doi) {
    elements.push(`<dc:identifier>${escapeXml(article.doi)}</dc:identifier>`);
  }
  
  // ⚠️ SOURCE - ¡EL FORMATEO EXACTO QUE DIALNET NECESITA!
  // Formato: "Nombre Revista; Vol. X Núm. Y (AÑO); PAGINAS"
  // SIN punto y coma entre el número y el año
  const sourceParts = [];
  
  if (REPO_NAME) {
    sourceParts.push(REPO_NAME);
  }
  
  // Unimos volumen, número y año en UN SOLO elemento
  let volumenNumeroAnyo = '';
  if (article.volumen && article.numero) {
    volumenNumeroAnyo = `Vol. ${article.volumen} Núm. ${article.numero}`;
  } else if (article.volumen) {
    volumenNumeroAnyo = `Vol. ${article.volumen}`;
  }
  
  // Añadimos el año al mismo elemento (sin punto y coma extra)
  if (article.fecha && volumenNumeroAnyo) {
    const year = new Date(article.fecha).getFullYear();
    volumenNumeroAnyo += ` (${year})`;
  } else if (article.fecha) {
    const year = new Date(article.fecha).getFullYear();
    volumenNumeroAnyo = `(${year})`;
  }
  
  if (volumenNumeroAnyo) {
    sourceParts.push(volumenNumeroAnyo);
  }
  
  if (article.primeraPagina && article.ultimaPagina) {
    sourceParts.push(`${article.primeraPagina}-${article.ultimaPagina}`);
  } else if (article.primeraPagina) {
    sourceParts.push(article.primeraPagina);
  }
  
  if (sourceParts.length > 0) {
    elements.push(`<dc:source xml:lang="es">${escapeXml(sourceParts.join('; '))}</dc:source>`);
  }
  
  // ⚠️ ISSN - SOLO EL DIGITAL 3087-2839
  elements.push(`<dc:source>3087-2839</dc:source>`);
  
  // ⚠️ LANGUAGE
  elements.push(`<dc:language>spa</dc:language>`);
  
  // ⚠️ RIGHTS - Formato de Revista de Indias
  elements.push(`<dc:rights xml:lang="es">Derechos de autor ${article.fecha ? new Date(article.fecha).getFullYear() : ''} ${REPO_NAME}</dc:rights>`);
  elements.push(`<dc:rights xml:lang="es">https://creativecommons.org/licenses/by/4.0</dc:rights>`);
  
  // ⚠️ PUBLISHER
  elements.push(`<dc:publisher xml:lang="es">${escapeXml(REPO_NAME)}</dc:publisher>`);
  
  // ⚠️ RESTO DE IDENTIFICADORES - VAN DESPUÉS DEL SOURCE
  elements.push(`<dc:identifier>${escapeXml(getArticleUrl(article))}</dc:identifier>`);
  if (article.pdfUrl) {
    elements.push(`<dc:identifier>${escapeXml(article.pdfUrl)}</dc:identifier>`);
  }
  
  // ⚠️ RELATION - Para el PDF
  if (article.pdfUrl) {
    elements.push(`<dc:relation>${escapeXml(article.pdfUrl)}</dc:relation>`);
  }

  return elements.join('\n      ');
}
/**
 * Extrae las referencias del HTML y las devuelve como texto plano
 * Formato esperado por Dialnet:
 * - Una referencia por línea
 * - Separadas por doble salto de línea (\n\n)
 * - Sin saltos de línea internos en cada referencia
 * - Sin guiones '———' para autores repetidos
 */
/**
 * Extrae las referencias del HTML y las devuelve en el formato que espera Dialnet:
 * "Referencias:\n1. Referencia 1\n2. Referencia 2\n..."
 * 
 * Formato exacto que pide Dialnet:
 * - Encabezado "Referencias:" en la primera línea
 * - Cada referencia numerada (1., 2., 3., ...)
 * - Cada referencia en una línea separada
 * - Sin saltos de línea internos en cada referencia
 * - Sin guiones '———' para autores repetidos (reemplazar por el nombre del autor)
 */
function extractReferencesAsText(htmlString) {
  if (!htmlString) return '';
  
  // Extraer referencias individuales
  const refs = [];
  
  // Buscar divs con clase "reference-item" (tu formato actual)
  const divMatches = htmlString.match(/<div[^>]*class="reference-item"[^>]*>([\s\S]*?)<\/div>/gi);
  if (divMatches) {
    let lastAuthor = ''; // Para reemplazar guiones de autor repetido
    
    divMatches.forEach(div => {
      let ref = div
        .replace(/<[^>]*>/g, '')           // Quitar etiquetas HTML
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\n\s*/g, ' ')            // Quitar saltos de línea internos
        .replace(/\s+/g, ' ')              // Normalizar espacios
        .trim();
      
      // Reemplazar guiones de autor repetido por el último autor conocido
      if (/^[—–\-—]/.test(ref) && lastAuthor) {
        ref = lastAuthor + ref.replace(/^[—–\-—]\s*/, '');
      } else {
        // Guardar el autor para posibles referencias siguientes con guiones
        const authorMatch = ref.match(/^([^.,]+)/);
        if (authorMatch) {
          lastAuthor = authorMatch[1].trim();
        }
      }
      
      if (ref) refs.push(ref);
    });
  } else {
    // Buscar párrafos <p> (formato OJS2/OJS3)
    const pMatches = htmlString.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches) {
      pMatches.forEach(p => {
        let ref = p
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\n\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (ref) refs.push(ref);
      });
    } else {
      // Texto plano separado por doble salto de línea
      const plainText = htmlString
        .replace(/<[^>]*>/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      
      const parts = plainText.split(/\n\s*\n/);
      parts.forEach(part => {
        const ref = part.replace(/\s+/g, ' ').trim();
        if (ref && ref.length > 10) refs.push(ref);
      });
    }
  }
  
  if (refs.length === 0) return '';
  
  // ⚠️ FORMATO EXACTO QUE PIDE DIALNET:
  // "Referencias:" + salto de línea + referencias numeradas
  const referenciasFormateadas = refs.map((ref, index) => `${index + 1}. ${ref}`).join('\n');
  
  return `Referencias:\n${referenciasFormateadas}`;
}
  
// =====================================================
// XML BUILDERS
// =====================================================
function buildXmlResponse(verbElement, requestAttrs = {}) {
  const now = new Date().toISOString();
  let attrStr = Object.entries(requestAttrs)
    .filter(([_, v]) => v != null)
    .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${now}</responseDate>
  <request${attrStr}>${escapeXml(BASE_URL)}</request>
  ${verbElement}
</OAI-PMH>`;
}

function buildErrorXml(code, message = '') {
  return buildXmlResponse(`<error code="${code}">${escapeXml(message)}</error>`);
}

function buildRecordXml(article) {
  const datestamp = article.updatedAt?.split('T')[0] || article.fecha || article.createdAt?.split('T')[0] || EARLIEST_DATESTAMP;

  let xml = ` <record>
    <header>
      <identifier>${escapeXml(oaiIdentifier(article.numeroArticulo))}</identifier>
      <datestamp>${datestamp}</datestamp>`;

  for (const spec of getSetSpecs(article)) {
    xml += `\n      <setSpec>${escapeXml(spec)}</setSpec>`;
  }

  xml += `
    </header>
    <metadata>
      <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
           xmlns:dc="http://purl.org/dc/elements/1.1/"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
  ${articleToDublinCore(article)}
</oai_dc:dc>
    </metadata>
  </record>`;
  return xml;
}

/**
 * Construye un registro OAI con metadatos en formato JATS
 * Usa el campo article.jats si existe, o genera un esqueleto mínimo
 */
function buildJatsRecordXml(article) {
  const datestamp = article.updatedAt?.split('T')[0] || article.fecha || article.createdAt?.split('T')[0] || EARLIEST_DATESTAMP;

  let xml = ` <record>
    <header>
      <identifier>${escapeXml(oaiIdentifier(article.numeroArticulo))}</identifier>
      <datestamp>${datestamp}</datestamp>`;

  for (const spec of getSetSpecs(article)) {
    xml += `\n      <setSpec>${escapeXml(spec)}</setSpec>`;
  }

  xml += `
    </header>
    <metadata>`;

  // Si el artículo tiene JATS generado por convert-jats.js, lo incluimos
  if (article.jats) {
    // Extraemos solo el contenido del artículo JATS sin la declaración XML ni DOCTYPE
    // para evitar duplicados dentro del registro OAI-PMH
    const jatsContent = article.jats
      .replace(/<\?xml[^?]*\?>\s*/g, '')   // Quitar declaración XML
      .replace(/<!DOCTYPE[^>]*>\s*/g, '');  // Quitar DOCTYPE
    
    xml += `\n${jatsContent}`;
  } else {
    // Si no hay JATS generado, creamos un esqueleto mínimo con los metadatos básicos
    const pubDate = article.fecha || '';
    const pubDateParts = pubDate.split('-');
    
    xml += `
      <article dtd-version="1.4" article-type="research-article" xml:lang="es"
               xmlns:mml="http://www.w3.org/1998/Math/MathML"
               xmlns:xlink="http://www.w3.org/1999/xlink">
        <front>
          <journal-meta>
            <journal-id journal-id-type="publisher">RNCE</journal-id>
            <journal-title-group>
              <journal-title>Revista Nacional de las Ciencias para Estudiantes</journal-title>
            </journal-title-group>
            <issn publication-format="electronic">3087-2839</issn>
            <publisher>
              <publisher-name>Revista Nacional de las Ciencias para Estudiantes</publisher-name>
            </publisher>
          </journal-meta>
          <article-meta>`;
    
    if (article.doi) {
      xml += `
            <article-id pub-id-type="doi">${escapeXml(article.doi)}</article-id>`;
    }
    
    xml += `
            <title-group>
              <article-title>${escapeXml(article.titulo || '')}</article-title>`;
    
    if (article.tituloEnglish) {
      xml += `
              <trans-title xml:lang="en">${escapeXml(article.tituloEnglish)}</trans-title>`;
    }
    
    xml += `
            </title-group>`;
    
    // Autores
    if (Array.isArray(article.autores) && article.autores.length > 0) {
      xml += `
            <contrib-group>`;
      
      article.autores.forEach((autor, index) => {
        const nameParts = (autor.name || '').split(' ');
        let givenNames = '';
        let surname = '';
        
        if (nameParts.length === 1) {
          surname = nameParts[0];
        } else if (nameParts.length === 2) {
          givenNames = nameParts[0];
          surname = nameParts[1];
        } else {
          surname = nameParts[nameParts.length - 1];
          givenNames = nameParts.slice(0, -1).join(' ');
        }
        
        xml += `
              <contrib contrib-type="author" id="author${index + 1}">`;
        
        if (autor.orcid) {
          xml += `
                <contrib-id contrib-id-type="orcid" authenticated="true">${escapeXml(autor.orcid)}</contrib-id>`;
        }
        
        xml += `
                <name>
                  <surname>${escapeXml(surname)}</surname>
                  <given-names>${escapeXml(givenNames)}</given-names>
                </name>`;
        
        if (autor.email) {
          xml += `
                <email>${escapeXml(autor.email)}</email>`;
        }
        
        if (autor.institution) {
          xml += `
                <xref ref-type="aff" rid="aff${index + 1}">${escapeXml(autor.institution)}</xref>`;
        }
        
        xml += `
              </contrib>`;
      });
      
      xml += `
            </contrib-group>`;
      
      // Afiliaciones
      const uniqueInstitutions = [...new Set(article.autores.map(a => a.institution).filter(Boolean))];
      if (uniqueInstitutions.length > 0) {
        xml += `
            <aff-alternatives>`;
        uniqueInstitutions.forEach((inst, idx) => {
          xml += `
              <aff id="aff${idx + 1}">
                <institution>${escapeXml(inst)}</institution>
              </aff>`;
        });
        xml += `
            </aff-alternatives>`;
      }
    }
    
    // Fecha de publicación
    if (pubDate) {
      xml += `
            <pub-date publication-format="electronic" date-type="pub" iso-8601-date="${pubDate}">
              <year>${pubDateParts[0] || ''}</year>`;
      if (pubDateParts[1]) {
        xml += `
              <month>${pubDateParts[1]}</month>`;
      }
      if (pubDateParts[2]) {
        xml += `
              <day>${pubDateParts[2]}</day>`;
      }
      xml += `
            </pub-date>`;
    }
    
    // Volumen, número, páginas
    if (article.volumen) {
      xml += `
            <volume>${escapeXml(article.volumen)}</volume>`;
    }
    if (article.numero) {
      xml += `
            <issue>${escapeXml(article.numero)}</issue>`;
    }
    if (article.primeraPagina) {
      xml += `
            <fpage>${escapeXml(article.primeraPagina)}</fpage>`;
    }
    if (article.ultimaPagina) {
      xml += `
            <lpage>${escapeXml(article.ultimaPagina)}</lpage>`;
    }
    
    // Fechas de recibido/aceptado
    if (article.receivedDate || article.acceptedDate) {
      xml += `
            <history>`;
      if (article.receivedDate) {
        xml += `
              <date date-type="received" iso-8601-date="${article.receivedDate}">
                <year>${article.receivedDate.split('-')[0]}</year>
                <month>${article.receivedDate.split('-')[1] || ''}</month>
                <day>${article.receivedDate.split('-')[2] || ''}</day>
              </date>`;
      }
      if (article.acceptedDate) {
        xml += `
              <date date-type="accepted" iso-8601-date="${article.acceptedDate}">
                <year>${article.acceptedDate.split('-')[0]}</year>
                <month>${article.acceptedDate.split('-')[1] || ''}</month>
                <day>${article.acceptedDate.split('-')[2] || ''}</day>
              </date>`;
      }
      xml += `
            </history>`;
    }
    
    // Licencia
    xml += `
            <permissions>
              <license license-type="open-access" xlink:href="https://creativecommons.org/licenses/by/4.0/">
                <license-p>Creative Commons Attribution 4.0 International License</license-p>
              </license>
            </permissions>`;
    
    // Abstracts
    if (article.resumen) {
      xml += `
            <abstract xml:lang="es">
              <title>Resumen</title>
              <p>${escapeXml(article.resumen)}</p>
            </abstract>`;
    }
    if (article.abstract) {
      xml += `
            <abstract xml:lang="en">
              <title>Abstract</title>
              <p>${escapeXml(article.abstract)}</p>
            </abstract>`;
    }
    
    // Palabras clave
    if (Array.isArray(article.palabras_clave) && article.palabras_clave.length > 0) {
      xml += `
            <kwd-group xml:lang="es">
              <title>Palabras clave</title>`;
      article.palabras_clave.forEach(kw => {
        if (kw) xml += `
              <kwd>${escapeXml(kw)}</kwd>`;
      });
      xml += `
            </kwd-group>`;
    }
    if (Array.isArray(article.keywords_english) && article.keywords_english.length > 0) {
      xml += `
            <kwd-group xml:lang="en">
              <title>Keywords</title>`;
      article.keywords_english.forEach(kw => {
        if (kw) xml += `
              <kwd>${escapeXml(kw)}</kwd>`;
      });
      xml += `
            </kwd-group>`;
    }
    
    xml += `
          </article-meta>
        </front>
      </article>`;
  }

  xml += `
    </metadata>
  </record>`;
  
  return xml;
}

// =====================================================
// FILTROS Y TOKENS
// =====================================================
function filterByDateRange(articles, from, until) {
  if (!from && !until) return articles;
  return articles.filter(a => {
    let d = a.fecha || a.updatedAt?.split('T')[0] || a.createdAt?.split('T')[0] || '';
    if (!d) return false;
    // Normalizar a YYYY-MM-DD
    d = d.split('T')[0];
    return (!from || d >= from) && (!until || d <= until);
  });
}

function filterBySet(articles, setSpec) {
  if (!setSpec) return articles;
  return articles.filter(a => getSetSpecs(a).some(s => s === setSpec || s.startsWith(setSpec + ':')));
}

function createResumptionToken(params, offset, totalCount) {
  const token = {
    from: params.from || null,
    until: params.until || null,
    set: params.set || null,
    metadataPrefix: params.metadataPrefix || 'oai_dc',
    offset,
    totalCount,
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000
  };
  return Buffer.from(JSON.stringify(token)).toString('base64');
}

function parseResumptionToken(tokenStr) {
  try {
    const token = JSON.parse(Buffer.from(tokenStr, 'base64').toString('utf8'));
    if (Date.now() > token.expiresAt) return null;
    return token;
  } catch {
    return null;
  }
}

function getPublishedArticles(articles) {
  if (!articles || !Array.isArray(articles)) {
    console.error("[OAI] articles no es un array");
    return [];
  }

  console.log(`[OAI] Total de artículos en JSON: ${articles.length}`);

  // Como no tienes campo "status", devolvemos TODOS
  const allArticles = [...articles];

  console.log(`[OAI] Devolviendo TODOS los artículos como publicados: ${allArticles.length}`);

  return allArticles;
}

async function getArticles(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedArticles && (now - lastFetch) < CACHE_TTL) {
    console.log('[OAI] Usando caché');
    return cachedArticles;
  }

  console.log('📥 [OAI] Obteniendo articles.json (forceRefresh =', forceRefresh, ')');

  const fetchFn = await ensureFetch();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const response = await fetchFn(ARTICLES_URL, { 
    signal: controller.signal 
  });

  clearTimeout(timeout);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  cachedArticles = await response.json();
  lastFetch = now;

  console.log(`✅ [OAI] Cargados ${cachedArticles.length} artículos del JSON`);
  return cachedArticles;
}

// =====================================================
// HANDLERS
// =====================================================
async function handleIdentify(res) {
  const articles = await getArticles();
  const published = getPublishedArticles(articles);
  
  let earliestDate = EARLIEST_DATESTAMP;

  if (published.length > 0) {
    const dates = published
      .map(a => a.fecha || a.createdAt?.split('T')[0] || a.updatedAt?.split('T')[0])
      .filter(Boolean)
      .sort();

    if (dates.length > 0) {
      earliestDate = dates[0];
    }
  }

  const xml = `
  <Identify>
    <repositoryName>${escapeXml(REPO_NAME)}</repositoryName>
    <baseURL>${escapeXml(BASE_URL)}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>${escapeXml(ADMIN_EMAIL)}</adminEmail>
    <earliestDatestamp>${earliestDate}</earliestDatestamp>
    <deletedRecord>transient</deletedRecord>
    <granularity>YYYY-MM-DD</granularity>
    <description>
      <oai-identifier xmlns="http://www.openarchives.org/OAI/2.0/oai-identifier"
                      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                      xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai-identifier http://www.openarchives.org/OAI/2.0/oai-identifier.xsd">
        <scheme>oai</scheme>
        <repositoryIdentifier>${escapeXml(REPO_IDENTIFIER)}</repositoryIdentifier>
        <delimiter>:</delimiter>
        <sampleIdentifier>oai:${escapeXml(REPO_IDENTIFIER)}:article/1</sampleIdentifier>
      </oai-identifier>
    </description>
  </Identify>`;

  res.status(200).send(buildXmlResponse(xml, { verb: 'Identify' }));
}

async function handleListMetadataFormats(res, params) {
  if (params.identifier) {
    const n = parseIdentifier(params.identifier);
    if (n === null) return res.status(200).send(buildErrorXml('idDoesNotExist'));
    const articles = await getArticles();
    if (!getPublishedArticles(articles).some(a => a.numeroArticulo === n)) {
      return res.status(200).send(buildErrorXml('idDoesNotExist'));
    }
  }

  const xml = `
  <ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
    <metadataFormat>
      <metadataPrefix>jats</metadataPrefix>
      <schema>https://jats.nlm.nih.gov/publishing/1.4/JATS-journalpublishing1.dtd</schema>
      <metadataNamespace>https://jats.nlm.nih.gov/publishing/1.4/</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>`;

  res.status(200).send(buildXmlResponse(xml, { verb: 'ListMetadataFormats', ...(params.identifier && { identifier: params.identifier }) }));
}

async function handleListSets(res) {
  const articles = await getArticles();
  const setMap = new Map();

  for (const a of getPublishedArticles(articles)) {
    for (const spec of getSetSpecs(a)) {
      if (!setMap.has(spec)) {
        let name = spec;
        if (spec.startsWith('area:')) name = `Área: ${spec.substring(5)}`;
        else if (spec.startsWith('tipo:')) name = `Tipo: ${spec.substring(5)}`;
        else if (spec.match(/^volumen:\d+:numero:\d+$/)) {
          const p = spec.split(':');
          name = `Volumen ${p[1]}, Número ${p[3]}`;
        } else if (spec.startsWith('volumen:')) name = `Volumen ${spec.substring(8)}`;
        setMap.set(spec, name);
      }
    }
  }

  let xml = ' <ListSets>\n';
  for (const [spec, name] of [...setMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    xml += ` <set><setSpec>${escapeXml(spec)}</setSpec><setName>${escapeXml(name)}</setName></set>\n`;
  }
  xml += ' </ListSets>';

  res.status(200).send(buildXmlResponse(xml, { verb: 'ListSets' }));
}

async function handleGetRecord(res, params) {
  const { identifier, metadataPrefix } = params;

  if (!identifier) return res.status(200).send(buildErrorXml('badArgument', 'Falta identifier'));
  if (!metadataPrefix) return res.status(200).send(buildErrorXml('badArgument', 'Falta metadataPrefix'));
  
  // Aceptar tanto oai_dc como jats
  if (metadataPrefix !== 'oai_dc' && metadataPrefix !== 'jats') {
    return res.status(200).send(buildErrorXml('cannotDisseminateFormat', `Formato no soportado: ${metadataPrefix}`));
  }

  const n = parseIdentifier(identifier);
  if (n === null) {
    return res.status(200).send(buildErrorXml('idDoesNotExist', `Formato inválido: ${identifier}`));
  }

  console.log(`[OAI] GetRecord - Buscando artículo ID: ${n} (formato: ${metadataPrefix})`);

  const articles = await getArticles(true);
  const published = getPublishedArticles(articles);

  const article = published.find(a => {
    const idArticulo = a.numeroArticulo;
    return idArticulo == n || String(idArticulo) == String(n);
  });

  if (!article) {
    console.error(`[OAI] Artículo ${n} NO encontrado.`);
    console.log(`[OAI] Primeros 5 IDs disponibles:`, 
      published.slice(0, 5).map(a => a.numeroArticulo));
    return res.status(200).send(buildErrorXml('idDoesNotExist', `Artículo ${n} no encontrado`));
  }

  console.log(`✅ [OAI] Artículo ${n} encontrado - Formato: ${metadataPrefix}`);

  let xml;
  if (metadataPrefix === 'jats') {
    xml = `<GetRecord>\n${buildJatsRecordXml(article)}\n </GetRecord>`;
  } else {
    xml = `<GetRecord>\n${buildRecordXml(article)}\n </GetRecord>`;
  }

  res.status(200).send(buildXmlResponse(xml, { verb: 'GetRecord', identifier, metadataPrefix }));
}

async function handleListIdentifiers(res, params) {
  return handleListPaginated(res, params, 'ListIdentifiers', false);
}

async function handleListRecords(res, params) {
  return handleListPaginated(res, params, 'ListRecords', true);
}

async function handleListPaginated(res, params, verb, includeFullRecord) {
  const { metadataPrefix, from, until, set, resumptionToken: tokenStr } = params;

  let q = { 
    from: from || null, 
    until: until || null, 
    set: set || null, 
    metadataPrefix: metadataPrefix || 'oai_dc', 
    offset: 0 
  };

  if (tokenStr) {
    const token = parseResumptionToken(tokenStr);
    if (!token) return res.status(200).send(buildErrorXml('badResumptionToken'));
    q = token;
  } else if (metadataPrefix) {
    // Aceptar tanto oai_dc como jats
    if (metadataPrefix !== 'oai_dc' && metadataPrefix !== 'jats') {
      return res.status(200).send(buildErrorXml('cannotDisseminateFormat', `Formato no soportado: ${metadataPrefix}`));
    }
  }

  const articles = await getArticles(true);
  let results = getPublishedArticles(articles);

  console.log(`[OAI] ${verb} - Total publicados antes de filtros: ${results.length} (formato: ${q.metadataPrefix})`);

 results = filterByDateRange(results, q.from, q.until);
  if (q.set) results = filterBySet(results, q.set);
  
  console.log(`[OAI] Después de filtros: ${results.length}`);
  
  if (results.length === 0) {
    return res.status(200).send(buildErrorXml('noRecordsMatch', 'No records match the given criteria'));
  }
  // Ordenar por número de artículo descendente (más nuevos primero)
  results.sort((a, b) => (b.numeroArticulo || 0) - (a.numeroArticulo || 0));

  const total = results.length;
  if (total === 0 && q.offset === 0) {
    return res.status(200).send(buildErrorXml('noRecordsMatch'));
  }

  const batch = results.slice(q.offset, q.offset + BATCH_SIZE);
  const hasMore = (q.offset + BATCH_SIZE) < total;

  console.log(`[OAI] Enviando batch desde ${q.offset} → ${batch.length} registros (total ${total})`);

  let xml = ` <${verb}>\n`;
  for (const a of batch) {
    if (includeFullRecord) {
      // Usar JATS si el metadataPrefix es jats, de lo contrario Dublin Core
      xml += (q.metadataPrefix === 'jats') ? buildJatsRecordXml(a) : buildRecordXml(a);
    } else {
      // ListIdentifiers: solo header, sin metadata
      xml += ` <header><identifier>${escapeXml(oaiIdentifier(a.numeroArticulo))}</identifier><datestamp>${a.fecha || EARLIEST_DATESTAMP}</datestamp>${getSetSpecs(a).map(s => `\n  <setSpec>${escapeXml(s)}</setSpec>`).join('')}</header>\n`;
    }
  }

  if (hasMore) {
    const token = createResumptionToken(q, q.offset + BATCH_SIZE, total);
    xml += ` <resumptionToken expirationDate="${new Date(Date.now() + 86400000).toISOString()}" completeListSize="${total}" cursor="${q.offset}">${token}</resumptionToken>\n`;
  } else if (q.offset > 0) {
    xml += ` <resumptionToken completeListSize="${total}" cursor="${q.offset}"/>\n`;
  }
  xml += ` </${verb}>`;

  const attrs = { verb, metadataPrefix: q.metadataPrefix };
  if (q.from) attrs.from = q.from;
  if (q.until) attrs.until = q.until;
  if (q.set) attrs.set = q.set;

  res.status(200).send(buildXmlResponse(xml, attrs));
}

// =====================================================
// EXPORTACIÓN FINAL
// =====================================================
exports.oai = onRequest(
  { timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (req, res) => {
    res.set('Content-Type', 'application/xml; charset=utf-8');

    try {
      // Blindaje inicial
      await ensureFetch();

      const params = req.method === 'POST' ? req.body : req.query;
      const verb = params?.verb;

      const validVerbs = ['Identify', 'ListMetadataFormats', 'ListSets', 'GetRecord', 'ListIdentifiers', 'ListRecords'];

      if (!verb || !validVerbs.includes(verb)) {
        return res.status(200).send(buildErrorXml('badVerb', verb ? `Verbo inválido: ${verb}` : 'Falta parámetro verb'));
      }

      console.log(`📥 [OAI] ${verb} - Params: ${JSON.stringify(params)}`);

      switch (verb) {
        case 'Identify': return await handleIdentify(res);
        case 'ListMetadataFormats': return await handleListMetadataFormats(res, params);
        case 'ListSets': return await handleListSets(res);
        case 'GetRecord': return await handleGetRecord(res, params);
        case 'ListIdentifiers': return await handleListIdentifiers(res, params);
        case 'ListRecords': return await handleListRecords(res, params);
        default: return res.status(200).send(buildErrorXml('badVerb'));
      }
    } catch (error) {
      console.error('❌ [OAI] Error crítico:', error);
      return res.status(200).send(buildErrorXml('badArgument', `Error interno: ${error.message}`));
    }
  }
);
// ===================== ON METADATA PROPOSAL CREATED (V2) =====================
/**
 * Cloud Function que se ejecuta cuando un editor crea una propuesta de cambios
 * en los metadatos de un artículo. Envía un correo al autor notificándole.
 * Soporte bilingüe (español/inglés) según paperLanguage del submission.
 */
exports.onMetadataProposalCreated = onDocumentCreated(
  {
    document: 'submissions/{submissionId}/metadataProposals/{proposalId}',
    secrets: [], // Si usas secrets, agrégalos aquí
    timeoutSeconds: 120,
    memory: '256MiB'
  },
  async (event) => {
    // Extraer parámetros de la ruta
    const submissionId = event.params.submissionId;
    const proposalId = event.params.proposalId;
    
    console.log(`📨 Nueva propuesta de metadatos: ${proposalId} para submission: ${submissionId}`);
    
    try {
      const db = admin.firestore();
      
      // 1. Obtener datos de la propuesta
      const proposalData = event.data.data();
      
      // Verificar que sea una propuesta pendiente de autor
      if (proposalData.status !== 'pending-author') {
        console.log(`⏭️ Propuesta con estado ${proposalData.status}, no se envía correo`);
        return null;
      }
      
      // 2. Obtener datos del submission
      const submissionRef = db.collection('submissions').doc(submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        console.error(`❌ Submission ${submissionId} no encontrado`);
        return null;
      }
      
      const submission = submissionSnap.data();
      
      // 3. Determinar idioma (español por defecto)
      const isSpanish = submission.paperLanguage !== 'en';
      
      // 4. Obtener email del autor
      const authorEmail = submission.authorEmail || submission.correspondingAuthor?.email;
      
      if (!authorEmail) {
        console.error(`❌ No se encontró email del autor para submission ${submissionId}`);
        return null;
      }
      
      // 5. Obtener datos del editor que propuso
      const editorEmail = proposalData.proposedByEmail || 'Editor';
      const editorName = proposalData.proposedByName || 'Editor';
      
      // 6. Preparar datos para el correo
      const articleTitle = submission.title || 'Sin título';
      const changesCount = proposalData.changes?.length || 0;
      
      // Generar lista de cambios para el correo
      let changesList = '';
      if (proposalData.changes && Array.isArray(proposalData.changes)) {
        changesList = proposalData.changes.map((change, index) => {
          const fieldLabel = getFieldLabel(change.field, isSpanish);
          const reason = isSpanish 
            ? (change.reason || 'Sin justificación')
            : (change.reason || 'No justification provided');
          return `${index + 1}. **${fieldLabel}**: ${reason}`;
        }).join('\n');
      }
      
      // 7. Construir el cuerpo del correo según idioma
      const emailContent = buildProposalEmail({
        isSpanish,
        articleTitle,
        submissionId,
        editorName,
        editorEmail,
        changesCount,
        changesList,
        currentYear: new Date().getFullYear()
      });
      
      // 8. Enviar correo
      await sendEmailViaExtension(authorEmail, emailContent.subject, emailContent.htmlBody);
      
      console.log(`✅ Correo de propuesta de metadatos enviado a ${authorEmail} (${isSpanish ? 'es' : 'en'})`);
      
      // 9. Registrar en auditLogs que se envió el correo
      await db.collection('submissions').doc(submissionId).collection('auditLogs').add({
        action: 'metadata_proposal_email_sent',
        proposalId: proposalId,
        to: authorEmail,
        changesCount: changesCount,
        language: isSpanish ? 'es' : 'en',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: true, emailSent: authorEmail };
      
    } catch (error) {
      console.error(`❌ Error en onMetadataProposalCreated:`, error.message);
      console.error(error.stack);
      
      // Registrar error pero no fallar la función
      try {
        await admin.firestore().collection('systemErrors').add({
          function: 'onMetadataProposalCreated',
          submissionId: submissionId,
          proposalId: proposalId,
          error: {
            message: error.message,
            stack: error.stack
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error('❌ Error al registrar error:', logError.message);
      }
      
      return null;
    }
  }
);

// ===================== ON METADATA PROPOSAL UPDATED (V2) =====================
/**
 * Notifica al editor cuando el autor responde a una propuesta
 * Soporte bilingüe (español/inglés)
 */
exports.onMetadataProposalUpdated = onDocumentUpdated(
  {
    document: 'submissions/{submissionId}/metadataProposals/{proposalId}',
    secrets: [],
    timeoutSeconds: 120,
    memory: '256MiB'
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    const proposalId = event.params.proposalId;
    
    const before = event.data.before.data();
    const after = event.data.after.data();
    
    // Solo nos interesa cuando cambia de 'pending-author' a otro estado
    if (before.status === after.status) {
      return null;
    }
    
    // Solo si el autor respondió (aprobó o rechazó)
    if (!['approved', 'rejected'].includes(after.status)) {
      return null;
    }
    
    console.log(`📨 Respuesta del autor a propuesta ${proposalId}: ${after.status}`);
    
    try {
      const db = admin.firestore();
      
      // Obtener datos del submission
      const submissionRef = db.collection('submissions').doc(submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        console.error(`❌ Submission ${submissionId} no encontrado`);
        return null;
      }
      
      const submission = submissionSnap.data();
      
      // Determinar idioma
      const isSpanish = submission.paperLanguage !== 'en';
      
      // Obtener email del editor que propuso
      const editorEmail = after.proposedByEmail;
      
      if (!editorEmail) {
        console.log(`⚠️ No se encontró email del editor para notificar`);
        return null;
      }
      
      // Construir email de respuesta
      const emailContent = buildResponseEmail({
        isSpanish,
        submissionTitle: submission.title || 'Sin título',
        submissionId,
        status: after.status,
        authorComments: after.authorResponse?.comments || null,
        currentYear: new Date().getFullYear()
      });
      
      await sendEmailViaExtension(editorEmail, emailContent.subject, emailContent.htmlBody);
      
      console.log(`✅ Notificación de respuesta enviada a editor: ${editorEmail} (${isSpanish ? 'es' : 'en'})`);
      
      // Registrar en auditLogs
      await db.collection('submissions').doc(submissionId).collection('auditLogs').add({
        action: 'metadata_proposal_response_notified',
        proposalId: proposalId,
        to: editorEmail,
        status: after.status,
        language: isSpanish ? 'es' : 'en',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
    } catch (error) {
      console.error(`❌ Error en onMetadataProposalUpdated:`, error.message);
      return null;
    }
  }
);
// ===================== FUNCIÓN: buildProposalEmail =====================
function buildProposalEmail({ isSpanish, articleTitle, submissionId, editorName, editorEmail, changesCount, changesList, currentYear }) {
  if (isSpanish) {
    return {
      subject: `📝 Propuesta de corrección de metadatos - "${articleTitle.substring(0, 50)}${articleTitle.length > 50 ? '...' : ''}"`,
      htmlBody: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 20px auto; background-color:#ffffff; border-radius:4px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color:#003b5c; padding:30px 20px; text-align:center; }
    .header h1 { color:#ffffff; font-size:20px; font-weight:700; margin:0; font-family:'Georgia',serif; }
    .content { padding:30px 40px; }
    .greeting { font-size:16px; color:#1f2937; margin-bottom:20px; }
    .alert-box { background-color:#fffbeb; border-left:4px solid #d97706; padding:15px 20px; margin:20px 0; border-radius:2px; }
    .alert-box p { margin:0; color:#92400e; font-size:14px; line-height:1.6; }
    .article-title { font-size:18px; font-weight:700; color:#003b5c; margin:0 0 5px 0; }
    .article-meta { font-size:13px; color:#6b7280; margin-bottom:20px; }
    .changes-box { background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:15px 20px; margin:20px 0; }
    .changes-box h3 { font-size:13px; font-weight:700; color:#1e293b; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:1px; }
    .change-item { padding:8px 0; border-bottom:1px solid #e2e8f0; font-size:14px; color:#334155; }
    .change-item:last-child { border-bottom:none; }
    .change-field { font-weight:600; color:#003b5c; }
    .btn-container { text-align:center; margin:30px 0 20px 0; }
    .btn { background-color:#003b5c; color:#ffffff !important; padding:14px 35px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:600; display:inline-block; }
    .btn:hover { background-color:#002c45; }
    .footer { padding:20px; text-align:center; color:#9ca3af; font-size:11px; border-top:1px solid #e5e7eb; }
    .footer a { color:#003b5c; text-decoration:none; }
    .info-text { color:#6b7280; font-size:13px; margin-top:15px; line-height:1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 Revisión de Metadatos</h1>
    </div>
    <div class="content">
      <p class="greeting">Estimado/a autor/a,</p>
      
      <p>El editor <strong>${editorName}</strong> (${editorEmail}) ha realizado una propuesta de corrección sobre los metadatos de su artículo:</p>
      
      <div class="article-title">"${articleTitle}"</div>
      <div class="article-meta">ID de envío: ${submissionId}</div>
      
      <div class="alert-box">
        <p>🔔 <strong>Se requiere su revisión y aprobación</strong> para que estos cambios puedan ser aplicados formalmente al registro bibliográfico de su artículo.</p>
      </div>
      
      <div class="changes-box">
        <h3>📋 Cambios propuestos (${changesCount})</h3>
        ${changesList || '<p style="color:#6b7280;font-size:14px;">No se especificaron cambios detallados.</p>'}
      </div>
      
      <p style="font-size:14px;color:#4b5563;">
        <strong>¿Qué debe hacer?</strong>
      </p>
      <ol style="font-size:14px;color:#4b5563;line-height:1.8;padding-left:20px;">
        <li>Ingrese al <a href="https://www.revistacienciasestudiantes.com/es/login" style="color:#003b5c;">portal de autor</a></li>
        <li>Vaya a la sección de <strong>"Mis Envíos"</strong></li>
        <li>Seleccione el artículo y vaya a la pestaña <strong>"Revisión de Metadatos"</strong></li>
        <li>Revise cada cambio propuesto y <strong>ACEPTE</strong> o <strong>RECHAZE</strong> la propuesta</li>
      </ol>
      
      <div class="btn-container">
        <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">Ir al Portal</a>
      </div>
      
      <div class="info-text">
        <p><strong>Nota importante:</strong> Si no responde en un plazo de <strong>7 días hábiles</strong>, los cambios propuestos podrían ser aplicados automáticamente según el criterio editorial, de acuerdo con las políticas de la revista.</p>
        <p style="margin-top:10px;">Si tiene dudas, puede responder directamente a este correo para contactar al editor.</p>
      </div>
      
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
      
      <p style="font-size:13px;color:#6b7280;text-align:center;">
        Este es un correo automático generado por el sistema editorial.<br>
        Revista Nacional de las Ciencias para Estudiantes
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} Revista Nacional de las Ciencias para Estudiantes</p>
    </div>
  </div>
</body>
</html>`
    };
  } else {
    // VERSIÓN EN INGLÉS
    return {
      subject: `📝 Metadata correction proposal - "${articleTitle.substring(0, 50)}${articleTitle.length > 50 ? '...' : ''}"`,
      htmlBody: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 20px auto; background-color:#ffffff; border-radius:4px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color:#003b5c; padding:30px 20px; text-align:center; }
    .header h1 { color:#ffffff; font-size:20px; font-weight:700; margin:0; font-family:'Georgia',serif; }
    .content { padding:30px 40px; }
    .greeting { font-size:16px; color:#1f2937; margin-bottom:20px; }
    .alert-box { background-color:#fffbeb; border-left:4px solid #d97706; padding:15px 20px; margin:20px 0; border-radius:2px; }
    .alert-box p { margin:0; color:#92400e; font-size:14px; line-height:1.6; }
    .article-title { font-size:18px; font-weight:700; color:#003b5c; margin:0 0 5px 0; }
    .article-meta { font-size:13px; color:#6b7280; margin-bottom:20px; }
    .changes-box { background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:15px 20px; margin:20px 0; }
    .changes-box h3 { font-size:13px; font-weight:700; color:#1e293b; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:1px; }
    .change-item { padding:8px 0; border-bottom:1px solid #e2e8f0; font-size:14px; color:#334155; }
    .change-item:last-child { border-bottom:none; }
    .change-field { font-weight:600; color:#003b5c; }
    .btn-container { text-align:center; margin:30px 0 20px 0; }
    .btn { background-color:#003b5c; color:#ffffff !important; padding:14px 35px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:600; display:inline-block; }
    .btn:hover { background-color:#002c45; }
    .footer { padding:20px; text-align:center; color:#9ca3af; font-size:11px; border-top:1px solid #e5e7eb; }
    .footer a { color:#003b5c; text-decoration:none; }
    .info-text { color:#6b7280; font-size:13px; margin-top:15px; line-height:1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📝 Metadata Review</h1>
    </div>
    <div class="content">
      <p class="greeting">Dear Author,</p>
      
      <p>Editor <strong>${editorName}</strong> (${editorEmail}) has proposed corrections to the metadata of your article:</p>
      
      <div class="article-title">"${articleTitle}"</div>
      <div class="article-meta">Submission ID: ${submissionId}</div>
      
      <div class="alert-box">
        <p>🔔 <strong>Your review and approval are required</strong> for these changes to be formally applied to the bibliographic record of your article.</p>
      </div>
      
      <div class="changes-box">
        <h3>📋 Proposed Changes (${changesCount})</h3>
        ${changesList || '<p style="color:#6b7280;font-size:14px;">No detailed changes were specified.</p>'}
      </div>
      
      <p style="font-size:14px;color:#4b5563;">
        <strong>What should you do?</strong>
      </p>
      <ol style="font-size:14px;color:#4b5563;line-height:1.8;padding-left:20px;">
        <li>Log in to the <a href="https://www.revistacienciasestudiantes.com/en/login" style="color:#003b5c;">author portal</a></li>
        <li>Go to <strong>"My Submissions"</strong></li>
        <li>Select the article and go to the <strong>"Metadata Review"</strong> tab</li>
        <li>Review each proposed change and <strong>ACCEPT</strong> or <strong>REJECT</strong> the proposal</li>
      </ol>
      
      <div class="btn-container">
        <a href="https://www.revistacienciasestudiantes.com/en/login" class="btn">Go to Portal</a>
      </div>
      
      <div class="info-text">
        <p><strong>Important note:</strong> If you do not respond within <strong>7 business days</strong>, the proposed changes may be automatically applied according to editorial criteria, in accordance with the journal's policies.</p>
        <p style="margin-top:10px;">If you have questions, you can reply directly to this email to contact the editor.</p>
      </div>
      
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
      
      <p style="font-size:13px;color:#6b7280;text-align:center;">
        This is an automated email generated by the editorial system.<br>
        National Review of Sciences for Students
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} National Review of Sciences for Students</p>
    </div>
  </div>
</body>
</html>`
    };
  }
}

// ===================== FUNCIÓN: buildResponseEmail =====================
function buildResponseEmail({ isSpanish, submissionTitle, submissionId, status, authorComments, currentYear }) {
  const isApproved = status === 'approved';
  
  if (isSpanish) {
    const statusText = isApproved ? 'APROBADA ✅' : 'RECHAZADA ❌';
    const statusColor = isApproved ? '#059669' : '#dc2626';
    
    return {
      subject: `📋 Propuesta de metadatos ${statusText} - "${submissionTitle.substring(0, 40)}${submissionTitle.length > 40 ? '...' : ''}"`,
      htmlBody: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 20px auto; background-color:#ffffff; border-radius:4px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color:#003b5c; padding:25px 20px; text-align:center; }
    .header h1 { color:#ffffff; font-size:18px; font-weight:700; margin:0; }
    .content { padding:30px 40px; }
    .status-box { text-align:center; padding:20px; margin:20px 0; border-radius:4px; background-color:#f8fafc; border:2px solid ${statusColor}; }
    .status-box .status { font-size:24px; font-weight:700; color:${statusColor}; }
    .greeting { font-size:16px; color:#1f2937; }
    .btn-container { text-align:center; margin:25px 0; }
    .btn { background-color:#003b5c; color:#ffffff !important; padding:12px 30px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:600; display:inline-block; }
    .footer { padding:20px; text-align:center; color:#9ca3af; font-size:11px; border-top:1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Respuesta del Autor</h1>
    </div>
    <div class="content">
      <p class="greeting">Estimado/a editor/a,</p>
      
      <p>El autor ha respondido a su propuesta de corrección de metadatos para el artículo:</p>
      
      <div style="font-weight:600;font-size:16px;color:#003b5c;margin:10px 0;">
        "${submissionTitle}"
      </div>
      
      <div class="status-box">
        <div class="status">${statusText}</div>
        <p style="margin-top:5px;color:#4b5563;font-size:14px;">
          ${isApproved 
            ? 'El autor ha aceptado los cambios propuestos.' 
            : 'El autor ha rechazado los cambios propuestos.'}
        </p>
        ${authorComments ? `
          <div style="margin-top:10px;padding:10px;background-color:#f1f5f9;border-radius:4px;text-align:left;font-style:italic;color:#1e293b;">
            "${authorComments}"
          </div>
        ` : ''}
      </div>
      
      ${isApproved ? `
        <div style="background-color:#ecfdf5;border-left:4px solid #059669;padding:12px 16px;margin:15px 0;border-radius:2px;">
          <p style="margin:0;font-size:14px;color:#065f46;">
            ✅ Los cambios han sido aprobados. Puede <strong>aplicarlos al sistema</strong> desde el panel editorial.
          </p>
        </div>
      ` : `
        <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:15px 0;border-radius:2px;">
          <p style="margin:0;font-size:14px;color:#991b1b;">
            ❌ Los cambios han sido rechazados. Puede contactar al autor para discutir alternativas.
          </p>
        </div>
      `}
      
      <div class="btn-container">
        <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">Ver en Portal</a>
      </div>
      
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
      <p style="font-size:12px;color:#6b7280;text-align:center;">
        Este es un correo automático del sistema editorial.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} Revista Nacional de las Ciencias para Estudiantes</p>
    </div>
  </div>
</body>
</html>`
    };
  } else {
    // VERSIÓN EN INGLÉS
    const statusText = isApproved ? 'APPROVED ✅' : 'REJECTED ❌';
    const statusColor = isApproved ? '#059669' : '#dc2626';
    
    return {
      subject: `📋 Metadata proposal ${statusText} - "${submissionTitle.substring(0, 40)}${submissionTitle.length > 40 ? '...' : ''}"`,
      htmlBody: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background-color:#f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 20px auto; background-color:#ffffff; border-radius:4px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background-color:#003b5c; padding:25px 20px; text-align:center; }
    .header h1 { color:#ffffff; font-size:18px; font-weight:700; margin:0; }
    .content { padding:30px 40px; }
    .status-box { text-align:center; padding:20px; margin:20px 0; border-radius:4px; background-color:#f8fafc; border:2px solid ${statusColor}; }
    .status-box .status { font-size:24px; font-weight:700; color:${statusColor}; }
    .greeting { font-size:16px; color:#1f2937; }
    .btn-container { text-align:center; margin:25px 0; }
    .btn { background-color:#003b5c; color:#ffffff !important; padding:12px 30px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:600; display:inline-block; }
    .footer { padding:20px; text-align:center; color:#9ca3af; font-size:11px; border-top:1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Author Response</h1>
    </div>
    <div class="content">
      <p class="greeting">Dear Editor,</p>
      
      <p>The author has responded to your metadata correction proposal for the article:</p>
      
      <div style="font-weight:600;font-size:16px;color:#003b5c;margin:10px 0;">
        "${submissionTitle}"
      </div>
      
      <div class="status-box">
        <div class="status">${statusText}</div>
        <p style="margin-top:5px;color:#4b5563;font-size:14px;">
          ${isApproved 
            ? 'The author has accepted the proposed changes.' 
            : 'The author has rejected the proposed changes.'}
        </p>
        ${authorComments ? `
          <div style="margin-top:10px;padding:10px;background-color:#f1f5f9;border-radius:4px;text-align:left;font-style:italic;color:#1e293b;">
            "${authorComments}"
          </div>
        ` : ''}
      </div>
      
      ${isApproved ? `
        <div style="background-color:#ecfdf5;border-left:4px solid #059669;padding:12px 16px;margin:15px 0;border-radius:2px;">
          <p style="margin:0;font-size:14px;color:#065f46;">
            ✅ Changes have been approved. You can <strong>apply them to the system</strong> from the editorial panel.
          </p>
        </div>
      ` : `
        <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:15px 0;border-radius:2px;">
          <p style="margin:0;font-size:14px;color:#991b1b;">
            ❌ Changes have been rejected. You can contact the author to discuss alternatives.
          </p>
        </div>
      `}
      
      <div class="btn-container">
        <a href="https://www.revistacienciasestudiantes.com/en/login" class="btn">View in Portal</a>
      </div>
      
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
      <p style="font-size:12px;color:#6b7280;text-align:center;">
        This is an automated email from the editorial system.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} National Review of Sciences for Students</p>
    </div>
  </div>
</body>
</html>`
    };
  }
}

// ===================== FUNCIÓN AUXILIAR: getFieldLabel =====================
function getFieldLabel(fieldName, isSpanish) {
  const labels = {
    'title': { es: 'Título', en: 'Title' },
    'titleEn': { es: 'Título (Inglés)', en: 'Title (English)' },
    'abstract': { es: 'Resumen', en: 'Abstract' },
    'abstractEn': { es: 'Resumen (Inglés)', en: 'Abstract (English)' },
    'keywords': { es: 'Palabras Clave', en: 'Keywords' },
    'keywordsEn': { es: 'Palabras Clave (Inglés)', en: 'Keywords (English)' },
    'authors': { es: 'Autores', en: 'Authors' },
    'funding': { es: 'Financiamiento', en: 'Funding' },
    'conflictOfInterest': { es: 'Conflicto de Intereses', en: 'Conflict of Interest' },
    'dataAvailability': { es: 'Disponibilidad de Datos', en: 'Data Availability' },
    'codeAvailability': { es: 'Disponibilidad de Código', en: 'Code Availability' },
    'acknowledgments': { es: 'Agradecimientos', en: 'Acknowledgments' },
    'articleType': { es: 'Tipo de Artículo', en: 'Article Type' },
    'area': { es: 'Área de Conocimiento', en: 'Knowledge Area' }
  };
  
  const label = labels[fieldName];
  if (!label) return fieldName;
  return isSpanish ? label.es : label.en;
}

exports.approveReviewerApplication = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB', // Nota: en v2 es 'MiB' no 'MB'
    region: 'us-central1', // Especifica tu región
  },
  async (request) => {
    // En v2, el context está dentro de request.auth y request.data
    const data = request.data;
    const auth = request.auth;
    
    // ========== VALIDACIÓN DE AUTENTICACIÓN ==========
    if (!auth) {
      throw new HttpsError(
        'unauthenticated',
        'Debes iniciar sesión para realizar esta acción.'
      );
    }

    const callerUid = auth.uid;
    const callerEmail = auth.token.email || '';

    // ========== VALIDACIÓN DE ROL ==========
    const callerDoc = await admin.firestore()
      .collection('users')
      .doc(callerUid)
      .get();

    if (!callerDoc.exists) {
      throw new HttpsError(
        'not-found',
        'Perfil de usuario no encontrado.'
      );
    }

    const callerData = callerDoc.data();
    const callerRoles = callerData.roles || [];

    const authorizedRoles = ['Director General', 'Editor en Jefe', 'Editor de Sección'];
    const hasAuthorization = callerRoles.some(role => authorizedRoles.includes(role));

    if (!hasAuthorization) {
      throw new HttpsError(
        'permission-denied',
        'No tienes permisos para aprobar revisores. Se requiere rol de Director, Editor en Jefe o Editor de Sección.'
      );
    }

    // ========== VALIDACIÓN DE PARÁMETROS ==========
    const { submissionId, reviewerUid } = data;

    if (!submissionId) {
      throw new HttpsError(
        'invalid-argument',
        'Se requiere el ID de la submission (submissionId).'
      );
    }

    if (!reviewerUid) {
      throw new HttpsError(
        'invalid-argument',
        'Se requiere el UID del revisor (reviewerUid).'
      );
    }

    const db = admin.firestore();
    const batch = db.batch();

    try {
      // ========== 1. OBTENER DATOS DE LA SUBMISSION ==========
      const submissionRef = db.collection('submissions').doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        throw new HttpsError(
          'not-found',
          `No se encontró la submission con ID: ${submissionId}`
        );
      }

      const submissionData = submissionDoc.data();

      // Verificar que la submission sea del usuario correcto
      if (submissionData.authorUID !== reviewerUid) {
        throw new HttpsError(
          'invalid-argument',
          'El UID del revisor no coincide con el autor de la submission.'
        );
      }

      // Verificar que la solicitud de revisor esté pendiente
      if (!submissionData.wantsToBeReviewer) {
        throw new HttpsError(
          'failed-precondition',
          'Esta submission no tiene una solicitud de revisor activa.'
        );
      }

      if (submissionData.reviewerStatus === 'approved') {
        throw new HttpsError(
          'already-exists',
          'Esta solicitud de revisor ya fue aprobada anteriormente.'
        );
      }

      // ========== 2. OBTENER DATOS DEL PERFIL DE USUARIO ==========
      const userRef = db.collection('users').doc(reviewerUid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError(
          'not-found',
          'Perfil de usuario no encontrado en la colección users.'
        );
      }

      const userData = userDoc.data();

      // ========== 3. CALCULAR ESTADÍSTICAS DE REVISIÓN ==========
      const reviewerStats = await calculateReviewerStats(reviewerUid, db);

      // ========== 4. CREAR DOCUMENTO EN COLECCIÓN 'reviewers' ==========
      const reviewerId = reviewerUid;
      const reviewerRef = db.collection('reviewers').doc(reviewerId);

      const reviewerData = {
        uid: reviewerUid,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        displayName: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        email: userData.email || submissionData.authorEmail || '',
        publicEmail: userData.publicEmail || '',
        institution: userData.institution || (submissionData.authors?.[0]?.institution) || '',
        orcid: userData.orcid || (submissionData.authors?.[0]?.orcid) || '',
        areasOfExpertise: submissionData.reviewerAreas || [],
        interests: userData.interests || { es: [], en: [] },
        status: 'active',
        availability: {
          maxActiveReviews: 3,
          currentActiveReviews: 0,
          preferredLanguage: submissionData.paperLanguage || 'es',
          timeAvailablePerReview: '2-weeks',
        },
        stats: reviewerStats,
        approvedBy: {
          uid: callerUid,
          email: callerEmail,
          name: callerData.displayName || `${callerData.firstName || ''} ${callerData.lastName || ''}`.trim(),
          role: callerRoles.find(r => authorizedRoles.includes(r)) || 'Editor',
        },
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        applicationSource: {
          type: 'submission',
          submissionId: submissionId,
          articleTitle: submissionData.title || '',
          articleArea: submissionData.area || '',
        },
        notifications: {
          newReviewRequest: true,
          reminderBeforeDeadline: true,
          reminderDays: [7, 3, 1],
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      batch.set(reviewerRef, reviewerData);

      // ========== 5. ACTUALIZAR ROLES DEL USUARIO ==========
      try {
        const authUser = await admin.auth().getUser(reviewerUid);
        const currentClaims = authUser.customClaims || {};
        const currentRoles = currentClaims.roles || [];
        
        if (!currentRoles.includes('Revisor')) {
          const updatedRoles = [...currentRoles, 'Revisor'];
          await admin.auth().setCustomUserClaims(reviewerUid, {
            ...currentClaims,
            roles: updatedRoles,
          });
          
          console.log(`✅ Rol 'Revisor' agregado en Auth para usuario ${reviewerUid}`);
        }
      } catch (authError) {
        console.error('⚠️ Error actualizando Custom Claims:', authError.message);
      }

      // Actualizar en Firestore
      const currentUserRoles = userData.roles || [];
      if (!currentUserRoles.includes('Revisor')) {
        batch.update(userRef, {
          roles: [...currentUserRoles, 'Revisor'],
          reviewerProfileId: reviewerId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // ========== 6. ACTUALIZAR ESTADO EN LA SUBMISSION ==========
      batch.update(submissionRef, {
        reviewerStatus: 'approved',
        reviewerApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewerApprovedBy: callerUid,
        reviewerProfileId: reviewerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ========== 7. REGISTRAR EN AUDITORÍA ==========
      const auditRef = db.collection('auditLogs').doc();
      batch.set(auditRef, {
        action: 'reviewer_application_approved',
        targetType: 'reviewer',
        targetId: reviewerId,
        submissionId: submissionId,
        performedBy: {
          uid: callerUid,
          email: callerEmail,
          name: callerData.displayName || '',
        },
        details: {
          reviewerUid: reviewerUid,
          reviewerEmail: userData.email || '',
          reviewerName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
          areasOfExpertise: submissionData.reviewerAreas || [],
          source: 'submission_application',
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: request.rawRequest?.ip || 'unknown', // Cambiado de context.rawRequest a request.rawRequest
      });

      const submissionAuditRef = db.collection('submissions')
        .doc(submissionId)
        .collection('auditLogs')
        .doc();
      
      batch.set(submissionAuditRef, {
        action: 'reviewer_application_approved',
        performedBy: {
          uid: callerUid,
          email: callerEmail,
          name: callerData.displayName || '',
          role: callerRoles.find(r => authorizedRoles.includes(r)) || 'Editor',
        },
        details: {
          reviewerProfileCreated: reviewerId,
          areasApproved: submissionData.reviewerAreas || [],
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ========== 8. EJECUTAR TRANSACCIÓN ==========
      await batch.commit();

      console.log(`✅ Solicitud de revisor aprobada: ${reviewerId}`);

      return {
        success: true,
        message: 'Solicitud de revisor aprobada exitosamente.',
        data: {
          reviewerId: reviewerId,
          reviewerUid: reviewerUid,
          areasOfExpertise: submissionData.reviewerAreas || [],
          stats: reviewerStats,
          approvedBy: {
            name: callerData.displayName || '',
            role: callerRoles.find(r => authorizedRoles.includes(r)) || 'Editor',
          },
        },
      };

    } catch (error) {
      console.error('❌ Error aprobando revisor:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        'internal',
        'Error interno al aprobar la solicitud de revisor.',
        { originalError: error.message }
      );
    }
  }
);

// Función rechazar revisor - v2
exports.rejectReviewerApplication = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    const auth = request.auth;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    const callerUid = auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    const callerRoles = callerDoc.data()?.roles || [];
    
    const authorizedRoles = ['Director General', 'Editor en Jefe', 'Editor de Sección'];
    if (!callerRoles.some(role => authorizedRoles.includes(role))) {
      throw new HttpsError('permission-denied', 'No tienes permisos.');
    }

    const { submissionId, reason } = request.data;
    if (!submissionId) {
      throw new HttpsError('invalid-argument', 'Se requiere submissionId.');
    }

    const db = admin.firestore();
    const batch = db.batch();

    const submissionRef = db.collection('submissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      throw new HttpsError('not-found', 'Submission no encontrada.');
    }

    batch.update(submissionRef, {
      reviewerStatus: 'rejected',
      reviewerRejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewerRejectedBy: callerUid,
      reviewerRejectionReason: reason || 'No especificado',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const auditRef = db.collection('auditLogs').doc();
    batch.set(auditRef, {
      action: 'reviewer_application_rejected',
      targetType: 'reviewer_application',
      submissionId: submissionId,
      performedBy: {
        uid: callerUid,
        email: auth.token.email || '',
      },
      details: { reason: reason || 'No especificado' },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      message: 'Solicitud de revisor rechazada.',
    };
  }
);

/**
 * Función auxiliar: Calcular estadísticas del revisor
 * 
 * Analiza las colecciones:
 * - reviewerInvitations: invitaciones enviadas
 * - reviewerAssignments: revisiones asignadas y completadas
 * 
 * Calcula:
 * - totalInvitations: total de invitaciones recibidas
 * - acceptedInvitations: invitaciones aceptadas
 * - declinedInvitations: invitaciones rechazadas
 * - expiredInvitations: invitaciones expiradas
 * - acceptanceRate: tasa de aceptación (%)
 * - totalReviewsCompleted: revisiones completadas y enviadas
 * - onTimeReviews: revisiones entregadas a tiempo
 * - lateReviews: revisiones entregadas fuera de plazo
 * - averageReviewScore: promedio de puntuaciones dadas
 * - responseTimeAvg: tiempo promedio de respuesta (días)
 */
async function calculateReviewerStats(reviewerUid, db) {
  try {
    // ===== ESTADÍSTICAS DE INVITACIONES =====
    const invitationsSnapshot = await db.collection('reviewerInvitations')
      .where('reviewerUid', '==', reviewerUid)
      .get();

    const invitations = [];
    invitationsSnapshot.forEach(doc => {
      invitations.push({ id: doc.id, ...doc.data() });
    });

    const totalInvitations = invitations.length;
    const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted').length;
    const declinedInvitations = invitations.filter(inv => inv.status === 'declined').length;
    const expiredInvitations = invitations.filter(inv => inv.status === 'expired').length;
    const failedInvitations = invitations.filter(inv => inv.status === 'failed').length;

    const acceptanceRate = totalInvitations > 0
      ? Math.round((acceptedInvitations / totalInvitations) * 100)
      : 0;

    // Calcular tiempo promedio de respuesta
    const responseTimes = invitations
      .filter(inv => inv.respondedAt && inv.createdAt)
      .map(inv => {
        const created = inv.createdAt.toDate();
        const responded = inv.respondedAt.toDate();
        return (responded - created) / (1000 * 60 * 60 * 24); // días
      });

    const responseTimeAvg = responseTimes.length > 0
      ? parseFloat((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1))
      : null;

    // ===== ESTADÍSTICAS DE REVISIONES =====
    const assignmentsSnapshot = await db.collection('reviewerAssignments')
      .where('reviewerUid', '==', reviewerUid)
      .get();

    const assignments = [];
    assignmentsSnapshot.forEach(doc => {
      assignments.push({ id: doc.id, ...doc.data() });
    });

    const totalReviewsCompleted = assignments.filter(a => a.status === 'submitted').length;
    const pendingReviews = assignments.filter(a => a.status === 'accepted' || a.status === 'in_progress').length;

    // Revisiones a tiempo vs tarde
    let onTimeReviews = 0;
    let lateReviews = 0;

    assignments
      .filter(a => a.status === 'submitted' && a.submittedAt && a.dueDate)
      .forEach(a => {
        const submitted = a.submittedAt.toDate();
        const due = a.dueDate.toDate();
        if (submitted <= due) {
          onTimeReviews++;
        } else {
          lateReviews++;
        }
      });

    const onTimeRate = totalReviewsCompleted > 0
      ? Math.round((onTimeReviews / totalReviewsCompleted) * 100)
      : 100;

    // Promedio de puntuaciones
    const scores = assignments
      .filter(a => a.status === 'submitted' && a.scores)
      .map(a => {
        const s = a.scores;
        const scoreValues = Object.values(s).filter(v => typeof v === 'number');
        return scoreValues.length > 0
          ? scoreValues.reduce((sum, v) => sum + v, 0) / scoreValues.length
          : null;
      })
      .filter(s => s !== null);

    const averageReviewScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : null;

    // Revisiones por ronda (útil para saber experiencia)
    const reviewsByRound = {};
    assignments.forEach(a => {
      const round = a.round || 1;
      reviewsByRound[round] = (reviewsByRound[round] || 0) + 1;
    });

    return {
      // Invitaciones
      totalInvitations,
      acceptedInvitations,
      declinedInvitations,
      expiredInvitations,
      failedInvitations,
      acceptanceRate,
      responseTimeAvgDays: responseTimeAvg,

      // Revisiones
      totalReviewsCompleted,
      pendingReviews,
      onTimeReviews,
      lateReviews,
      onTimeRate,
      averageReviewScore,
      maxScore: 5, // Escala de puntuación

      // Experiencia
      reviewsByRound,
      totalRoundsParticipated: Object.keys(reviewsByRound).length,

      // Última actividad
      lastInvitationAt: invitations.length > 0
        ? invitations.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0))[0]?.createdAt?.toDate()?.toISOString() || null
        : null,
      lastReviewSubmittedAt: assignments
        .filter(a => a.submittedAt)
        .sort((a, b) => b.submittedAt.toDate() - a.submittedAt.toDate())[0]?.submittedAt?.toDate()?.toISOString() || null,
    };

  } catch (error) {
    console.error('⚠️ Error calculando estadísticas de revisor:', error.message);
    // Devolver estadísticas vacías en caso de error
    return {
      totalInvitations: 0,
      acceptedInvitations: 0,
      declinedInvitations: 0,
      expiredInvitations: 0,
      failedInvitations: 0,
      acceptanceRate: 0,
      responseTimeAvgDays: null,
      totalReviewsCompleted: 0,
      pendingReviews: 0,
      onTimeReviews: 0,
      lateReviews: 0,
      onTimeRate: 100,
      averageReviewScore: null,
      maxScore: 5,
      reviewsByRound: {},
      totalRoundsParticipated: 0,
      lastInvitationAt: null,
      lastReviewSubmittedAt: null,
      error: error.message,
    };
  }
}
exports.onReviewerRoleAssigned = onDocumentUpdated(
  {
    document: 'users/{userId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    // Obtener datos antes y después
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    if (!beforeData || !afterData) {
      console.log('⚠️ Datos incompletos, ignorando...');
      return null;
    }

    const userId = event.params.userId;
    const beforeRoles = beforeData.roles || [];
    const afterRoles = afterData.roles || [];

    // Verificar si el rol "Revisor" fue agregado
    const hadReviewerRole = beforeRoles.includes('Revisor');
    const hasReviewerRole = afterRoles.includes('Revisor');

    // Si ya tenía el rol o no se agregó ahora, ignorar
    if (hadReviewerRole || !hasReviewerRole) {
      console.log(`ℹ️ Usuario ${userId} no obtuvo rol Revisor en esta actualización`);
      return null;
    }

    console.log(`🔄 Nuevo revisor detectado: ${userId}`);

    try {
      // ========== 1. INICIALIZAR PERFIL DE REVISOR ==========
      const db = admin.firestore();
      
      // Verificar si ya existe perfil de revisor
      const reviewerRef = db.collection('reviewers').doc(userId);
      const reviewerDoc = await reviewerRef.get();

      if (reviewerDoc.exists) {
        console.log(`ℹ️ El usuario ${userId} ya tiene perfil de revisor. Verificando estado...`);
        
        const reviewerData = reviewerDoc.data();
        
        // Si el perfil está inactivo, reactivarlo
        if (reviewerData.status === 'inactive') {
          await reviewerRef.update({
            status: 'active',
            reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`✅ Perfil de revisor reactivado para ${userId}`);
        }
        
        // Iniciar proceso de bienvenida
        await initializeReviewerWelcome(userId, reviewerData);
        return { success: true, message: 'Perfil de revisor ya existente, proceso de bienvenida iniciado' };
      }

      // ========== 2. OBTENER DATOS DEL USUARIO ==========
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.error(`❌ Usuario ${userId} no encontrado en Firestore`);
        return null;
      }

      const userData = userDoc.data();

      // ========== 3. BUSCAR SOLICITUDES PENDIENTES ==========
      // Buscar submissions donde el usuario solicitó ser revisor
      const pendingSubmissionsSnapshot = await db.collection('submissions')
        .where('authorUID', '==', userId)
        .where('wantsToBeReviewer', '==', true)
        .where('reviewerStatus', '==', 'pending')
        .limit(1)
        .get();

      let applicationSource = null;
      let areasOfExpertise = [];
      let paperLanguage = 'es';

      if (!pendingSubmissionsSnapshot.empty) {
        const submissionDoc = pendingSubmissionsSnapshot.docs[0];
        const submissionData = submissionDoc.data();
        
        applicationSource = {
          type: 'submission',
          submissionId: submissionDoc.id,
          articleTitle: submissionData.title || '',
          articleArea: submissionData.area || '',
        };
        areasOfExpertise = submissionData.reviewerAreas || [];
        paperLanguage = submissionData.paperLanguage || 'es';

        console.log(`📝 Solicitud encontrada en submission: ${submissionDoc.id}`);
      } else {
        // Si no hay solicitud activa, buscar en otras fuentes
        console.log(`ℹ️ No se encontraron solicitudes pendientes para ${userId}`);
        
        // Buscar si tiene áreas de expertise en su perfil
        areasOfExpertise = userData.areasOfExpertise || [];
      }

      // ========== 4. CALCULAR ESTADÍSTICAS INICIALES ==========
      const reviewerStats = await calculateReviewerStats(userId, db);

      // ========== 5. CREAR PERFIL DE REVISOR ==========
      const reviewerData = {
        uid: userId,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        displayName: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        email: userData.email || '',
        publicEmail: userData.publicEmail || '',
        institution: userData.institution || '',
        orcid: userData.orcid || '',
        areasOfExpertise: areasOfExpertise,
        interests: userData.interests || { es: [], en: [] },
        status: 'active',
        availability: {
          maxActiveReviews: 3,
          currentActiveReviews: 0,
          preferredLanguage: paperLanguage || 'es',
          timeAvailablePerReview: '2-weeks',
        },
        stats: reviewerStats,
        approvedBy: {
          uid: 'system',
          email: 'system@revista.com',
          name: 'Sistema',
          role: 'Sistema',
        },
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        applicationSource: applicationSource || {
          type: 'direct',
          source: 'role_assignment',
        },
        notifications: {
          newReviewRequest: true,
          reminderBeforeDeadline: true,
          reminderDays: [7, 3, 1],
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await reviewerRef.set(reviewerData);
      console.log(`✅ Perfil de revisor creado para ${userId}`);

      // ========== 6. ACTUALIZAR REFERENCIA EN USUARIO ==========
      await db.collection('users').doc(userId).update({
        reviewerProfileId: userId,
        reviewerCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ========== 7. INICIAR PROCESO DE BIENVENIDA ==========
      await initializeReviewerWelcome(userId, reviewerData);

      // ========== 8. REGISTRAR EN AUDITORÍA ==========
      await db.collection('auditLogs').add({
        action: 'reviewer_profile_created_auto',
        targetType: 'reviewer',
        targetId: userId,
        performedBy: {
          uid: 'system',
          email: 'system@revista.com',
          name: 'Sistema',
        },
        details: {
          source: reviewerData.applicationSource,
          areasOfExpertise: areasOfExpertise,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ========== 9. ACTUALIZAR CUSTOM CLAIMS ==========
      try {
        const authUser = await admin.auth().getUser(userId);
        const currentClaims = authUser.customClaims || {};
        
        if (!currentClaims.roles || !currentClaims.roles.includes('Revisor')) {
          await admin.auth().setCustomUserClaims(userId, {
            ...currentClaims,
            roles: [...(currentClaims.roles || []), 'Revisor'],
          });
          console.log(`✅ Custom claims actualizados para ${userId}`);
        }
      } catch (authError) {
        console.error(`⚠️ Error actualizando custom claims: ${authError.message}`);
      }

      console.log(`🎉 Proceso completado para nuevo revisor: ${userId}`);
      
      return {
        success: true,
        message: 'Perfil de revisor creado y proceso de bienvenida iniciado',
        data: {
          userId: userId,
          areasOfExpertise: areasOfExpertise,
          stats: reviewerStats,
        },
      };

    } catch (error) {
      console.error(`❌ Error en onReviewerRoleAssigned:`, error);
      return null;
    }
  }
);

// ========== FUNCIÓN AUXILIAR: Inicializar bienvenida ==========
async function initializeReviewerWelcome(userId, reviewerData) {
  const db = admin.firestore();
  const tasks = [];

  try {
    // 1. Crear notificación de bienvenida
    const notificationRef = db.collection('notifications').doc();
    tasks.push(
      notificationRef.set({
        uid: userId,
        type: 'reviewer_welcome',
        title: {
          es: '¡Bienvenido al equipo de revisores!',
          en: 'Welcome to the reviewer team!',
        },
        message: {
          es: 'Has sido agregado como revisor de la revista. Por favor, revisa tu perfil y configura tus preferencias de revisión.',
          en: 'You have been added as a reviewer for the journal. Please review your profile and configure your review preferences.',
        },
        data: {
          reviewerId: userId,
          status: 'active',
        },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        priority: 'high',
      })
    );

    // 3. Agregar a estadísticas globales
    const statsRef = db.collection('systemStats').doc('reviewers');
    tasks.push(
      statsRef.set({
        totalReviewers: admin.firestore.FieldValue.increment(1),
        activeReviewers: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    );

    // Ejecutar todas las tareas en paralelo
    await Promise.all(tasks);
    console.log(`📧 Proceso de bienvenida iniciado para ${userId}`);

    return true;

  } catch (error) {
    console.error(`❌ Error en initializeReviewerWelcome:`, error);
    // No lanzamos error para no interrumpir el flujo principal
    return false;
  }
}
/* ===================== FUNCIÓN: GENERAR CERTIFICADO CON PDFKIT (OPTIMIZADA) ===================== */
/**
 * Genera el certificado de aceptación usando PDFKit
 * FLUJO OPTIMIZADO: Crea documento Firestore primero, genera PDF una sola vez con QR
 * @param {Object} submissionData - Datos del submission con metadata final
 * @param {Object} options - Opciones adicionales
 * @returns {Object} - Información del certificado generado
 */
async function generateAcceptanceCertificate(submissionData, options = {}) {
  const requestId = `CERT-${submissionData.submissionId || 'unknown'}-${Date.now()}`;
  console.log(`[${requestId}] 🏆 Generando certificado de aceptación (FLUJO OPTIMIZADO)...`);
  
  try {
    const db = admin.firestore();
    
    // ==========================================
    // 1. Determinar idioma del certificado
    // ==========================================
    const lang = submissionData.paperLanguage || 
                 submissionData.currentMetadata?.paperLanguage ||
                 submissionData.currentMetadata?.language ||
                 submissionData.language || 
                 'es';
    const isSpanish = lang === 'es';
    
    console.log(`[${requestId}] 📝 Idioma del certificado: ${lang}`);
    
    // ==========================================
    // 2. Obtener metadatos finales consolidados
    // ==========================================
    const finalMetadata = submissionData.currentMetadata || submissionData;
    
    // ==========================================
    // 3. Determinar fecha de aceptación
    // ==========================================
    function getAcceptanceDate() {
      if (options.acceptanceDate) return options.acceptanceDate;
      
      if (submissionData.acceptedDate) {
        if (typeof submissionData.acceptedDate === 'string') return submissionData.acceptedDate;
        if (submissionData.acceptedDate.toDate) return submissionData.acceptedDate.toDate().toISOString().split('T')[0];
      }
      
      if (submissionData.acceptedAt) {
        if (submissionData.acceptedAt.toDate) return submissionData.acceptedAt.toDate().toISOString().split('T')[0];
        if (submissionData.acceptedAt instanceof Date) return submissionData.acceptedAt.toISOString().split('T')[0];
      }
      
      if (submissionData.decisionMadeAt) {
        if (submissionData.decisionMadeAt.toDate) return submissionData.decisionMadeAt.toDate().toISOString().split('T')[0];
        if (submissionData.decisionMadeAt instanceof Date) return submissionData.decisionMadeAt.toISOString().split('T')[0];
      }
      
      if (finalMetadata.acceptedDate) {
        if (typeof finalMetadata.acceptedDate === 'string') return finalMetadata.acceptedDate;
        if (finalMetadata.acceptedDate.toDate) return finalMetadata.acceptedDate.toDate().toISOString().split('T')[0];
      }
      
      console.log(`[${requestId}] ⚠️ No se encontró fecha de aceptación, usando fecha actual`);
      return new Date().toISOString().split('T')[0];
    }
    
    const acceptanceDate = getAcceptanceDate();
    console.log(`[${requestId}] 📅 Fecha de aceptación: ${acceptanceDate}`);
    
    // ==========================================
    // 4. Preparar autores formateados
    // ==========================================
    const authors = (finalMetadata.authors || submissionData.authors || []).map(a => ({
      firstName: a.firstName || '',
      lastName: a.lastName || '',
      email: a.email || null,
      orcid: a.orcid || null,
      fullName: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || 'Autor',
      institution: a.institution || null,
      isCorresponding: a.isCorresponding || false
    }));
    
    // ==========================================
    // 5. Preparar datos para el certificado
    // ==========================================
    const certificateData = {
      title: finalMetadata.title || submissionData.title || 'Sin título',
      authors: authors,
      submissionId: submissionData.submissionId,
      acceptanceDate: acceptanceDate,
      certificateNumber: options.certificateNumber || 
        `RNCE-${submissionData.submissionId?.substring(0, 8) || 'XXXXXXXX'}-${new Date().getFullYear()}`,
      volume: submissionData.volumen || 'En prensa',
      issue: submissionData.numero || 'En prensa',
      pages: submissionData.primeraPagina && submissionData.ultimaPagina 
        ? `${submissionData.primeraPagina}-${submissionData.ultimaPagina}`
        : 'En prensa',
      doi: submissionData.doi || null,
      paperLanguage: lang,
      articleType: submissionData.articleType || 'research',
      area: submissionData.area || finalMetadata.area || null
    };
    
    console.log(`[${requestId}] 📊 Datos del certificado:`, {
      title: certificateData.title.substring(0, 50) + '...',
      authorsCount: certificateData.authors.length,
      certNumber: certificateData.certificateNumber
    });
    
    // ==========================================
    // 6. CREAR DOCUMENTO EN FIRESTORE PRIMERO
    // ==========================================
    console.log(`[${requestId}] 📝 Creando documento en Firestore para obtener ID...`);
    
    // Verificar si ya existe un certificado con el mismo número
    const existingCertQuery = await db.collection('certificates')
      .where('certificateNumber', '==', certificateData.certificateNumber)
      .limit(1)
      .get();
    
    let certificateDocRef;
    let oldFileId = null;
    
    if (!existingCertQuery.empty) {
      // Actualizar certificado existente
      certificateDocRef = existingCertQuery.docs[0].ref;
      oldFileId = existingCertQuery.docs[0].data().fileId || null;
      
      console.log(`[${requestId}] 🔄 Certificado existente encontrado: ${certificateDocRef.id}`);
      
      // Actualizar con datos preliminares
      await certificateDocRef.update({
        title: certificateData.title,
        authors: authors,
        acceptanceDate: certificateData.acceptanceDate,
        status: 'regenerating',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Crear nuevo documento con datos preliminares
      certificateDocRef = await db.collection('certificates').add({
        certificateNumber: certificateData.certificateNumber,
        submissionId: submissionData.submissionId,
        title: certificateData.title,
        authors: authors,
        acceptanceDate: certificateData.acceptanceDate,
        language: lang,
        status: 'generating',
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`[${requestId}] ✅ Documento creado con ID: ${certificateDocRef.id}`);
    }
    
    // OBTENER EL ID DEL DOCUMENTO PARA EL QR
    const certificateDocId = certificateDocRef.id;
    console.log(`[${requestId}] 🔑 ID del documento para QR: ${certificateDocId}`);
    
    // ==========================================
    // 7. GENERAR PDF UNA SOLA VEZ CON QR Y COMPRESIÓN
    // ==========================================
    console.log(`[${requestId}] 📄 Generando PDF único con QR y compresión...`);
    
    const pdfBuffer = await generateCertificatePDFWithDocId(
      certificateData, 
      lang, 
      requestId, 
      certificateDocId,
      {
        compress: true,
        compressionLevel: options.compressionLevel || 7
      }
    );
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF vacío generado');
    }
    
    const initialSizeKB = (pdfBuffer.length / 1024).toFixed(2);
    console.log(`[${requestId}] 📄 PDF generado: ${initialSizeKB}KB`);
    
    // ==========================================
    // 8. COMPRIMIR PDF ADICIONALMENTE SI ES NECESARIO
    // ==========================================
    let finalPdfBuffer = pdfBuffer;
    
    if (options.enableExtraCompression !== false) {
      finalPdfBuffer = await compressPDFBuffer(pdfBuffer, requestId, {
        compressionLevel: options.compressionLevel || 7,
        minSizeToCompress: options.minSizeToCompress || 500 * 1024 // 500KB
      });
    }
    
    const finalSizeKB = (finalPdfBuffer.length / 1024).toFixed(2);
    console.log(`[${requestId}] 📊 Tamaño final del PDF: ${finalSizeKB}KB`);
    
    // ==========================================
    // 9. Inicializar Drive USANDO TU FUNCIÓN EXISTENTE
    // ==========================================
    const { drive } = await getDriveClient(requestId);
    
    // ==========================================
    // 10. Obtener o crear carpeta para certificados
    // ==========================================
    const editorialFolderId = submissionData.editorialFolderId || submissionData.driveFolderId;
    
    if (!editorialFolderId) {
      throw new Error('No se encontró carpeta editorial para el submission');
    }
    
    // Crear subcarpeta para certificados usando TU FUNCIÓN EXISTENTE
    const certificateFolderName = `CERTIFICATES_${submissionData.submissionId}`;
    let certificateFolder;
    
    try {
      const folderResponse = await drive.files.list({
        q: `name='${certificateFolderName}' and '${editorialFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      if (folderResponse.data.files.length > 0) {
        certificateFolder = folderResponse.data.files[0];
        console.log(`[${requestId}] 📁 Carpeta de certificados existente: ${certificateFolder.id}`);
      } else {
        certificateFolder = await createDriveFolder(drive, certificateFolderName, editorialFolderId);
        console.log(`[${requestId}] 📁 Carpeta de certificados creada: ${certificateFolder.id}`);
      }
    } catch (folderError) {
      console.log(`[${requestId}] ⚠️ Error buscando carpeta, creando nueva:`, folderError.message);
      certificateFolder = await createDriveFolder(drive, certificateFolderName, editorialFolderId);
    }
    
    // ==========================================
    // 11. Subir PDF a Drive (UNA SOLA VEZ)
    // ==========================================
    const fileName = `CERTIFICATE_${submissionData.submissionId}_${certificateDocId.substring(0, 8)}.pdf`;
    const pdfBase64 = finalPdfBuffer.toString('base64');
    
    const certificateFile = await uploadToDrive(
      drive,
      pdfBase64,
      fileName,
      certificateFolder.id
    );
    
    console.log(`[${requestId}] ✅ Certificado subido a Drive: ${certificateFile.id}`);
    console.log(`[${requestId}] 🔗 URL: ${certificateFile.webViewLink}`);
    console.log(`[${requestId}] 🔓 Configurando permisos públicos...`);
    
    const publicPermissionResult = await makeFilePublic(drive, certificateFile.id);
    if (publicPermissionResult.success) {
      console.log(`[${requestId}] ✅ Certificado configurado como público (solo lectura)`);
    } else {
      console.warn(`[${requestId}] ⚠️ No se pudo configurar como público: ${publicPermissionResult.message}`);
    }
    
    // ==========================================
    // 12. Actualizar documento en Firestore con info final
    // ==========================================
    const publicCertificateData = {
      fileId: certificateFile.id,
      fileUrl: certificateFile.webViewLink,
      fileName: certificateFile.name,
      certificateNumber: certificateData.certificateNumber,
      verificationId: certificateDocId,
      qrContainsDocId: true,
      status: 'generated',
      language: lang,
      acceptanceDate: certificateData.acceptanceDate,
      title: certificateData.title,
      submissionId: submissionData.submissionId,
      authors: authors,
      volume: certificateData.volume,
      issue: certificateData.issue,
      pages: certificateData.pages,
      doi: certificateData.doi,
      paperLanguage: lang,
      articleType: certificateData.articleType,
      area: certificateData.area,
      isPublic: true,
      permissionType: 'anyone_reader',
      permissionsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      pdfSizeKB: parseFloat(finalSizeKB),
      compressionApplied: finalPdfBuffer !== pdfBuffer,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await certificateDocRef.update(publicCertificateData);
    console.log(`[${requestId}] 💾 Documento Firestore actualizado con información final`);
    
    // ==========================================
    // 13. Eliminar archivo anterior si existe
    // ==========================================
    if (oldFileId && oldFileId !== certificateFile.id) {
      try {
        await drive.files.delete({ fileId: oldFileId });
        console.log(`[${requestId}] ✓ Archivo anterior eliminado de Drive: ${oldFileId}`);
      } catch (deleteError) {
        console.log(`[${requestId}] ⚠️ No se pudo eliminar archivo anterior: ${deleteError.message}`);
      }
    }
    
    // ==========================================
    // 14. Actualizar submission con referencia al certificado
    // ==========================================
    const submissionRef = db.collection('submissions').doc(submissionData.submissionId);
    
    await submissionRef.update({
      certificateId: certificateDocId,
      certificateNumber: certificateData.certificateNumber,
      certificateFileId: certificateFile.id,
      certificateFileUrl: certificateFile.webViewLink,
      certificateGenerated: true,
      certificateGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[${requestId}] 💾 Submission actualizado con referencia al certificado`);
    
    // ==========================================
    // 15. Eliminar campo certificate antiguo si existe
    // ==========================================
    try {
      const submissionDoc = await submissionRef.get();
      if (submissionDoc.exists && submissionDoc.data().certificate) {
        await submissionRef.update({
          certificate: admin.firestore.FieldValue.delete()
        });
        console.log(`[${requestId}] ✓ Campo certificate antiguo eliminado`);
      }
    } catch (cleanupError) {
      console.log(`[${requestId}] ⚠️ No se pudo limpiar campo antiguo: ${cleanupError.message}`);
    }
    
    // ==========================================
    // 16. Eliminar subcolección certificate si existe
    // ==========================================
    try {
      const oldSubCertificates = await submissionRef.collection('certificate').get();
      if (!oldSubCertificates.empty) {
        const batch = db.batch();
        oldSubCertificates.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[${requestId}] ✓ ${oldSubCertificates.docs.length} certificados antiguos eliminados de subcolección`);
      }
    } catch (subCleanupError) {
      console.log(`[${requestId}] ⚠️ No se pudo limpiar subcolección: ${subCleanupError.message}`);
    }
    
    // ==========================================
    // 17. Registrar en audit log
    // ==========================================
    await submissionRef.collection('auditLogs').add({
      action: 'certificate_generated',
      certificateId: certificateDocId,
      certificateUrl: certificateFile.webViewLink,
      certificateNumber: certificateData.certificateNumber,
      language: lang,
      storedInPublicCollection: true,
      qrContainsDocId: true,
      pdfSizeKB: parseFloat(finalSizeKB),
      compressionApplied: finalPdfBuffer !== pdfBuffer,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[${requestId}] 📝 Audit log registrado`);
    
    // ==========================================
    // 18. Enviar email al autor con el certificado
    // ==========================================
    try {
      const authorEmail = submissionData.correspondingAuthorEmail || 
                          submissionData.authorEmail ||
                          (submissionData.authors?.find(a => a.isCorresponding)?.email) ||
                          (finalMetadata.authors?.find(a => a.isCorresponding)?.email) ||
                          null;
      
      if (authorEmail) {
        await sendCertificateEmail(
          authorEmail,
          certificateFile.webViewLink,
          {
            ...certificateData,
            authors: authors
          },
          lang
        );
        console.log(`[${requestId}] 📧 Email enviado al autor: ${authorEmail}`);
      } else {
        console.warn(`[${requestId}] ⚠️ No se encontró email del autor para enviar certificado`);
      }
    } catch (emailError) {
      console.error(`[${requestId}] ⚠️ Error enviando email:`, emailError.message);
    }
    
    // ==========================================
    // 19. Retornar resultado
    // ==========================================
    return {
      success: true,
      certificateId: certificateDocId,
      certificateUrl: certificateFile.webViewLink,
      certificateNumber: certificateData.certificateNumber,
      language: lang,
      storedIn: 'certificates',
      qrContainsDocId: true,
      pdfSizeKB: parseFloat(finalSizeKB),
      compressionApplied: finalPdfBuffer !== pdfBuffer
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generando certificado:`, error.message);
    throw error;
  }
}

/* ===================== FUNCIÓN: COMPRIMIR BUFFER PDF ===================== */
/**
 * Comprime un buffer PDF usando zlib con optimizaciones
 * @param {Buffer} pdfBuffer - Buffer del PDF original
 * @param {string} requestId - ID de seguimiento
 * @param {Object} options - Opciones de compresión
 * @returns {Promise<Buffer>} - PDF comprimido
 */
async function compressPDFBuffer(pdfBuffer, requestId = 'unknown', options = {}) {
  const zlib = require('zlib');
  
  const compressionOptions = {
    level: options.compressionLevel || 7,
    minSizeToCompress: options.minSizeToCompress || 500 * 1024, // 500KB por defecto
    maxCompressionRatio: options.maxCompressionRatio || 0.7 // No comprimir si no se logra al menos 30% de reducción
  };
  
  try {
    // Verificar si vale la pena comprimir
    if (pdfBuffer.length < compressionOptions.minSizeToCompress) {
      console.log(`[${requestId}] 📏 PDF menor a ${(compressionOptions.minSizeToCompress / 1024).toFixed(0)}KB, no requiere compresión adicional`);
      return pdfBuffer;
    }
    
    console.log(`[${requestId}] 🔄 Comprimiendo PDF de ${(pdfBuffer.length / 1024).toFixed(2)}KB...`);
    
    // Intentar compresión con zlib
    const compressedBuffer = await new Promise((resolve, reject) => {
      zlib.deflate(pdfBuffer, {
        level: compressionOptions.level,
        strategy: zlib.constants.Z_DEFAULT_STRATEGY,
        windowBits: 15,
        memLevel: 8
      }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    const originalSize = pdfBuffer.length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = compressedSize / originalSize;
    
    console.log(`[${requestId}] 📊 Compresión: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB`);
    console.log(`[${requestId}] 💾 Reducción: ${((1 - compressionRatio) * 100).toFixed(2)}%`);
    
    // Verificar si la compresión fue efectiva
    if (compressionRatio < compressionOptions.maxCompressionRatio) {
      console.log(`[${requestId}] ✅ Compresión efectiva, usando PDF comprimido`);
      return compressedBuffer;
    } else {
      console.log(`[${requestId}] ⚠️ Compresión no significativa, usando PDF original`);
      return pdfBuffer;
    }
    
  } catch (error) {
    console.warn(`[${requestId}] ⚠️ Error en compresión: ${error.message}, usando PDF original`);
    return pdfBuffer;
  }
}
/* ===================== FUNCIÓN: GENERAR PDF - DISEÑO EXACTO ORIGINAL ===================== */
async function generateCertificatePDFWithDocId(data, lang = 'es', requestId = 'unknown', certificateDocId = null, options = {}) {
  console.log(`[${requestId}] 🔧 Generando PDF con ID de documento en QR...`);
  
  try {
    const PDFDocument = require('pdfkit');
    const QRCode = require('qrcode');
    
    const isSpanish = lang === 'es';
    
    // USAR EL ID DEL DOCUMENTO COMO IDENTIFICADOR ÚNICO
    const verificationId = certificateDocId || data.certificateNumber;
    
    const CONFIG = {
      qr: { 
        sizeCm: 2, 
        offsetYCm: -0.5, 
        offsetXCm: 0, 
        errorCorrection: 'M', 
        margin: 2,
        width: 500, // Mantener tamaño original
        debug: false 
      },
      urlVerificacion: `https://www.revistacienciasestudiantes.com/verificar/index.html?id=${verificationId}`,
      cabecera: { 
        marginTopCm: 2.2, 
        extraSpaceCm: 0.3, 
        logoWidthCm: 3.2, 
        tituloSize: 22, 
        subtituloSize: 16 
      },
      // Solo agregar compresión, sin cambiar diseño
      compression: {
        enabled: options.compress !== false,
        level: options.compressionLevel || 7
      }
    };
    
    // Configuración IDÉNTICA al original, solo con compresión adicional
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: true,
      bufferPages: true,
      compress: CONFIG.compression.enabled, // Única adición
      pdfVersion: '1.7' // Única adición
    });
    
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    
    const pdfPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    
    const journalBlue = '#003B5C';
    const journalOrange = '#E86125';
    const lightGray = '#FBFBFC';
    const textGray = '#64748B';
    const textDark = '#333333';
    const textSlate = '#475569';
    
    function mmToPoints(mm) { return mm * 2.83465; }
    function cmToPoints(cm) { return cm * 28.3465; }
    
    const fontSans = 'Helvetica';
    const fontSansBold = 'Helvetica-Bold';
    const fontSansItalic = 'Helvetica-Oblique';
    const fontSerif = 'Times-Roman';
    const fontSerifBold = 'Times-Bold';
    const fontSerifItalic = 'Times-Italic';
    const fontSerifSemiBold = 'Times-Bold';
    
    const texts = isSpanish ? {
      journalName1: 'Revista Nacional de las Ciencias',
      journalName2: 'para Estudiantes',
      journalNameEn: 'The National Review of Sciences for Students',
      motto: 'Excelencia y rigor en la investigación estudiantil',
      certificateTitle: 'CERTIFICADO DE ACEPTACIÓN',
      introText: 'El Comité Editorial tiene el honor de certificar que el manuscrito original titulado:',
      authoredBy: 'De autoría a cargo de:',
      resolution: 'Ha superado exitosamente el proceso de revisión por pares doble ciego y control de calidad editorial, siendo ACEPTADO para su publicación oficial. El trabajo se encuentra actualmente en fase de producción y será publicado bajo la modalidad Online First.',
      manuscriptIdLabel: 'ID del Manuscrito:',
      acceptanceDateLabel: 'Fecha de Aceptación:',
      mottoText: '«Una revista por y para estudiantes»',
      verifyLabel: 'VERIFICAR AUTENTICIDAD'
    } : {
      journalName1: 'National Review of Sciences',
      journalName2: 'for Students',
      journalNameEn: 'Revista Nacional de las Ciencias para Estudiantes',
      motto: 'Excellence and rigor in student research',
      certificateTitle: 'CERTIFICATE OF ACCEPTANCE',
      introText: 'The Editorial Committee has the honor to certify that the original manuscript entitled:',
      authoredBy: 'Authored by:',
      resolution: 'Has successfully passed the double-blind peer review process and editorial quality control, being ACCEPTED for official publication. The work is currently in production phase and will be published under the Online First modality.',
      manuscriptIdLabel: 'Manuscript ID:',
      acceptanceDateLabel: 'Acceptance Date:',
      mottoText: '"A journal by and for students"',
      verifyLabel: 'VERIFY AUTHENTICITY'
    };
    
    // Formatear autores - IDÉNTICO al original
    const authorsList = data.authors
      ?.map(a => a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || 'Author')
      .join(', ') || 'Authors';
    
    const formattedDate = new Date(data.acceptanceDate).toLocaleDateString(
      isSpanish ? 'es-ES' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
    
    // ==========================================
    // MARCO PERIMETRAL Y FONDO (IDÉNTICO)
    // ==========================================
    doc.rect(0, 0, pageWidth, pageHeight).fill(lightGray);
    
    const borderOffset1 = cmToPoints(1.2);
    doc.lineWidth(4).strokeColor(journalBlue);
    doc.rect(borderOffset1, borderOffset1, pageWidth - 2 * borderOffset1, pageHeight - 2 * borderOffset1).stroke();
    
    const borderOffset2 = cmToPoints(1.4);
    doc.lineWidth(1).strokeColor(journalOrange);
    doc.rect(borderOffset2, borderOffset2, pageWidth - 2 * borderOffset2, pageHeight - 2 * borderOffset2).stroke();
    
    const largeTriangle = mmToPoints(23);
    const smallTriangle = mmToPoints(13);
    
    doc.fillColor(journalBlue);
    doc.moveTo(borderOffset1, borderOffset1)
       .lineTo(borderOffset1 + largeTriangle, borderOffset1)
       .lineTo(borderOffset1, borderOffset1 + largeTriangle)
       .fill();
    
    doc.fillColor(journalOrange);
    doc.moveTo(borderOffset1, borderOffset1)
       .lineTo(borderOffset1 + smallTriangle, borderOffset1)
       .lineTo(borderOffset1, borderOffset1 + smallTriangle)
       .fill();
    
    doc.fillColor(journalBlue);
    doc.moveTo(pageWidth - borderOffset1, pageHeight - borderOffset1)
       .lineTo(pageWidth - borderOffset1 - largeTriangle, pageHeight - borderOffset1)
       .lineTo(pageWidth - borderOffset1, pageHeight - borderOffset1 - largeTriangle)
       .fill();
    
    doc.fillColor(journalOrange);
    doc.moveTo(pageWidth - borderOffset1, pageHeight - borderOffset1)
       .lineTo(pageWidth - borderOffset1 - smallTriangle, pageHeight - borderOffset1)
       .lineTo(pageWidth - borderOffset1, pageHeight - borderOffset1 - smallTriangle)
       .fill();
    
    // Marca de agua (IDÉNTICA)
    const watermarkWidth = cmToPoints(12);
    doc.save();
    doc.opacity(0.03);
    try {
      const logoUrl = isSpanish ? 'https://www.revistacienciasestudiantes.com/logo.png' : 'https://www.revistacienciasestudiantes.com/logoEN.png';
      const response = await fetch(logoUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const logoBuffer = Buffer.from(arrayBuffer);
        doc.image(logoBuffer, (pageWidth - watermarkWidth) / 2, (pageHeight - watermarkWidth) / 2, { width: watermarkWidth });
      }
    } catch(e) {
      console.log(`[${requestId}] ⚠ Error al cargar marca de agua:`, e.message);
    }
    doc.restore();
    
    // ==========================================
    // MÁRGENES DE TRABAJO (IDÉNTICOS)
    // ==========================================
    const marginX = cmToPoints(2.5);
    const marginY = cmToPoints(CONFIG.cabecera.marginTopCm);
    const contentWidth = pageWidth - (2 * marginX);
    
    // ==========================================
    // CABECERA INSTITUCIONAL (IDÉNTICA)
    // ==========================================
    let currentY = marginY + cmToPoints(CONFIG.cabecera.extraSpaceCm);
    const logoWidth = cmToPoints(CONFIG.cabecera.logoWidthCm);
    
    try {
      const logoUrl = isSpanish ? 'https://www.revistacienciasestudiantes.com/logo.png' : 'https://www.revistacienciasestudiantes.com/logoEN.png';
      const response = await fetch(logoUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const logoBuffer = Buffer.from(arrayBuffer);
        doc.image(logoBuffer, marginX, currentY, { width: logoWidth });
      } else {
        doc.rect(marginX, currentY, logoWidth, logoWidth).strokeColor('#CCCCCC').lineWidth(1).stroke();
        doc.font(fontSans).fontSize(9).fillColor(textGray).text('LOGO', marginX, currentY + logoWidth/2 - 5, { width: logoWidth, align: 'center' });
      }
    } catch(e) {
      doc.rect(marginX, currentY, logoWidth, logoWidth).strokeColor('#CCCCCC').lineWidth(1).stroke();
      doc.font(fontSans).fontSize(9).fillColor(textGray).text('LOGO', marginX, currentY + logoWidth/2 - 5, { width: logoWidth, align: 'center' });
    }
    
    const headerTextX = marginX + cmToPoints(3.8);
    const extraSpace = cmToPoints(CONFIG.cabecera.extraSpaceCm);
    
    doc.font(fontSansBold).fontSize(CONFIG.cabecera.tituloSize).fillColor(journalBlue)
       .text(texts.journalName1, headerTextX, currentY + extraSpace);
       
    doc.font(fontSansBold).fontSize(CONFIG.cabecera.subtituloSize).fillColor(journalBlue)
       .text(texts.journalName2, headerTextX, currentY + 26 + extraSpace);
       
    doc.font(fontSansItalic).fontSize(8.5).fillColor(textGray)
       .text(texts.journalNameEn, headerTextX, currentY + 48 + extraSpace);
       
    doc.font(fontSans).fontSize(13).fillColor(journalOrange)
       .text(texts.motto, headerTextX, currentY + 62 + extraSpace);
    
    // ==========================================
    // CUERPO DEL CERTIFICADO (IDÉNTICO)
    // ==========================================
    const bodyStartY = cmToPoints(6.5);
    
    doc.font(fontSansBold).fontSize(26).fillColor(journalBlue)
       .text(texts.certificateTitle, marginX, bodyStartY, { width: contentWidth, align: 'center', characterSpacing: 1 });
    
    doc.font(fontSerif).fontSize(13.5).fillColor(textDark)
       .text(texts.introText, marginX, bodyStartY + cmToPoints(1.4), { width: contentWidth, align: 'center' });
    
    doc.font(fontSansBold).fontSize(16.5).fillColor(journalBlue)
       .text(`«${data.title}»`, marginX + cmToPoints(0.5), bodyStartY + cmToPoints(2.3), { width: contentWidth - cmToPoints(1), align: 'center', lineGap: 4 });
    
    let afterTitleY = doc.y + cmToPoints(0.4);
    
    doc.font(fontSerif).fontSize(13.5).fillColor(textDark)
       .text(texts.authoredBy, marginX, afterTitleY, { width: contentWidth, align: 'center' });
    
    doc.font(fontSerifSemiBold).fontSize(16).fillColor(textDark)
       .text(authorsList, marginX + cmToPoints(0.5), afterTitleY + cmToPoints(0.6), { width: contentWidth - cmToPoints(1), align: 'center', lineGap: 4 });
    
    let afterAuthorsY = doc.y + cmToPoints(0.7);
    const resBoxWidth = contentWidth - cmToPoints(2);
    const resBoxX = marginX + cmToPoints(1);
    
    doc.font(fontSerif).fontSize(12.5).fillColor(textDark)
       .text(texts.resolution, resBoxX, afterAuthorsY, { width: resBoxWidth, align: 'center', lineGap: 3 });
    
    // ==========================================
    // PIE CON QR DE AUTENTICIDAD (IDÉNTICO)
    // ==========================================
    const footerY = pageHeight - cmToPoints(4.5);
    
    doc.font(fontSansBold).fontSize(10).fillColor(textSlate)
       .text(`${texts.manuscriptIdLabel} `, marginX, footerY, { continued: true })
       .font(fontSans).text(data.submissionId);
       
    doc.font(fontSansBold)
       .text(`${texts.acceptanceDateLabel} `, marginX, footerY + 16, { continued: true })
       .font(fontSans).text(formattedDate);
    
    const colCenterWidth = contentWidth * 0.35;
    const colCenterX = marginX + (contentWidth * 0.325);
    doc.font(fontSerifItalic).fontSize(11).fillColor(journalBlue)
       .text(texts.mottoText, colCenterX, footerY, { width: colCenterWidth, align: 'center' });
    
    const colRightWidth = contentWidth * 0.35;
    const colRightX = marginX + (contentWidth * 0.65);
    const qrAreaWidth = cmToPoints(3);
    const qrAreaX = colRightX + (colRightWidth - qrAreaWidth) / 2;
    const qrAreaY = footerY + cmToPoints(0.5);
    
    doc.font(fontSansBold).fontSize(9).fillColor(journalBlue)
       .text(texts.verifyLabel, colRightX, qrAreaY - cmToPoints(0.8), { width: colRightWidth, align: 'center' });
    
    try {
      const qrDataURL = await QRCode.toDataURL(CONFIG.urlVerificacion, {
        errorCorrectionLevel: CONFIG.qr.errorCorrection,
        margin: CONFIG.qr.margin,
        width: CONFIG.qr.width,
        color: { dark: '#003B5C', light: '#FFFFFF' }
      });
      
      const qrBuffer = Buffer.from(qrDataURL.split(',')[1], 'base64');
      const qrSize = cmToPoints(CONFIG.qr.sizeCm);
      const qrX = qrAreaX + (qrAreaWidth - qrSize) / 2 + cmToPoints(CONFIG.qr.offsetXCm);
      const qrY = qrAreaY + cmToPoints(CONFIG.qr.offsetYCm);
      
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      
      console.log(`[${requestId}] ✅ QR insertado con ID: ${verificationId}`);
    } catch (qrError) {
      console.error(`[${requestId}] ❌ Error al insertar QR:`, qrError.message);
    }
    
    doc.end();
    const pdfBuffer = await pdfPromise;
    console.log(`[${requestId}] ✅ PDF generado: ${(pdfBuffer.length / 1024).toFixed(2)}KB`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generando PDF con Doc ID:`, error.message);
    throw new Error(`PDF generation with Doc ID failed: ${error.message}`);
  }
}
/* ===================== FUNCIÓN: OPTIMIZAR IMAGEN BUFFER ===================== */
/**
 * Optimiza un buffer de imagen para reducir su tamaño
 * @param {Buffer} imageBuffer - Buffer de la imagen original
 * @param {Object} options - Opciones de optimización
 * @returns {Promise<Buffer>} - Imagen optimizada
 */
async function optimizeImageBuffer(imageBuffer, options = {}) {
  try {
    const sharp = require('sharp');
    
    const optimizationOptions = {
      maxWidth: options.maxWidth || 400,
      quality: options.quality || 80,
      format: options.format || 'jpeg',
      compressionLevel: options.compressionLevel || 9
    };
    
    let sharpInstance = sharp(imageBuffer);
    
    // Redimensionar si es necesario
    const metadata = await sharpInstance.metadata();
    if (metadata.width > optimizationOptions.maxWidth) {
      sharpInstance = sharpInstance.resize(optimizationOptions.maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Aplicar formato y compresión
    switch (optimizationOptions.format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ 
          quality: optimizationOptions.quality,
          progressive: true,
          optimizeScans: true
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ 
          compressionLevel: optimizationOptions.compressionLevel,
          adaptiveFiltering: true,
          quality: optimizationOptions.quality
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ 
          quality: optimizationOptions.quality,
          lossless: false
        });
        break;
      default:
        sharpInstance = sharpInstance.jpeg({ 
          quality: optimizationOptions.quality,
          progressive: true
        });
    }
    
    const optimizedBuffer = await sharpInstance.toBuffer();
    
    console.log(`🖼️ Imagen optimizada: ${(imageBuffer.length / 1024).toFixed(2)}KB → ${(optimizedBuffer.length / 1024).toFixed(2)}KB`);
    
    return optimizedBuffer;
  } catch (error) {
    console.warn('⚠️ Error optimizando imagen, usando original:', error.message);
    return imageBuffer;
  }
}

/* ===================== FUNCIÓN: SUBIR ARCHIVO A DRIVE (COMPATIBLE CON TU SISTEMA) ===================== */
/**
 * Sube un archivo a Google Drive
 * @param {Object} drive - Cliente de Google Drive
 * @param {string} base64Content - Contenido en base64
 * @param {string} fileName - Nombre del archivo
 * @param {string} folderId - ID de la carpeta destino
 * @returns {Promise<Object>} - Información del archivo subido
 */
async function uploadToDrive(drive, base64Content, fileName, folderId) {
  try {
    if (!drive) throw new Error('Drive client no inicializado');
    if (!base64Content) throw new Error('base64Content es requerido');
    if (!fileName) throw new Error('fileName es requerido');
    
    const buffer = Buffer.from(base64Content, 'base64');
    
    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : []
    };
    
    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(buffer)
    };
    
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink, size'
    });
    
    console.log(`📤 Archivo subido: ${file.data.name} (${file.data.id})`);
    if (file.data.size) {
      console.log(`📏 Tamaño: ${(parseInt(file.data.size) / 1024).toFixed(2)}KB`);
    }
    
    return file.data;
  } catch (error) {
    console.error('❌ Error subiendo archivo a Drive:', error.message);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/* ===================== FUNCIÓN: HACER ARCHIVO PÚBLICO ===================== */
/**
 * Configura un archivo en Drive para que sea público (solo lectura)
 * @param {Object} drive - Cliente de Google Drive
 * @param {string} fileId - ID del archivo
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function makeFilePublic(drive, fileId) {
  try {
    if (!drive) throw new Error('Drive client no inicializado');
    if (!fileId) throw new Error('fileId es requerido');
    
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      fields: 'id',
    });
    
    console.log(`✅ Archivo ${fileId} configurado como público (solo lectura)`);
    return { success: true, message: 'Permiso público de solo lectura otorgado' };
  } catch (error) {
    // Si el permiso ya existe, no es un error crítico
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`✓ El archivo ${fileId} ya tiene permiso público`);
      return { success: true, message: 'Permiso público ya existente' };
    }
    
    console.error(`❌ Error al hacer público el archivo ${fileId}:`, error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/* ===================== FUNCIÓN: ENVIAR EMAIL CON CERTIFICADO ===================== */
/**
 * Envía email al autor con el enlace del certificado
 * USANDO EL DISEÑO INSTITUCIONAL DE getEmailTemplate
 */
async function sendCertificateEmail(to, certificateUrl, certificateData, lang = 'es') {
  if (!to) {
    console.log('⚠️ No hay email de autor para enviar certificado');
    return;
  }
  
  const isSpanish = lang === 'es';
  
  const emailTitle = isSpanish
    ? `🏆 Certificado de Aceptación - ${certificateData.title.substring(0, 50)}${certificateData.title.length > 50 ? '...' : ''}`
    : `🏆 Acceptance Certificate - ${certificateData.title.substring(0, 50)}${certificateData.title.length > 50 ? '...' : ''}`;
  
  const authorsList = certificateData.authors
    ?.map(a => `${a.firstName || ''} ${a.lastName || ''}`.trim())
    .filter(Boolean)
    .join(', ') || 'N/A';
  
  // Formatear fecha
  const formattedDate = certificateData.acceptanceDate
    ? new Date(certificateData.acceptanceDate).toLocaleDateString(
        isSpanish ? 'es-CL' : 'en-US',
        { day: 'numeric', month: 'long', year: 'numeric' }
      )
    : (isSpanish ? 'No disponible' : 'Not available');
  
  // Detalles del artículo
  const articleDetails = `
    <div class="highlight-box">
      <p class="article-title">"${sanitizeText(certificateData.title)}"</p>
      <p><strong>${isSpanish ? 'ID del Manuscrito:' : 'Manuscript ID:'}</strong> ${certificateData.submissionId || 'N/A'}</p>
      <p><strong>${isSpanish ? 'Autores:' : 'Authors:'}</strong> ${sanitizeText(authorsList)}</p>
      <p><strong>${isSpanish ? 'Fecha de Aceptación:' : 'Acceptance Date:'}</strong> ${formattedDate}</p>
      <p><strong>${isSpanish ? 'Código de Certificado:' : 'Certificate Code:'}</strong> ${certificateData.certificateNumber || 'N/A'}</p>
    </div>
  `;
  
  // Botón de descarga
  const downloadButton = `
    <div class="button-container">
      <a href="${certificateUrl}" class="btn">
        ${isSpanish ? '📄 DESCARGAR CERTIFICADO' : '📄 DOWNLOAD CERTIFICATE'}
      </a>
    </div>
  `;
  
  // Mensaje de felicitación
  const congratulationMessage = isSpanish
    ? `
      <div class="highlight-box" style="background-color: #f0fdf4; border-left-color: #16a34a;">
        <p style="margin: 0; color: #14532d;">
          <strong>¡Felicidades!</strong><br>
          Su artículo ha superado exitosamente el proceso de revisión por pares doble ciego 
          y ha sido <strong>ACEPTADO</strong> para su publicación oficial en la 
          <strong>Revista Nacional de las Ciencias para Estudiantes</strong>.
        </p>
      </div>
    `
    : `
      <div class="highlight-box" style="background-color: #f0fdf4; border-left-color: #16a34a;">
        <p style="margin: 0; color: #14532d;">
          <strong>Congratulations!</strong><br>
          Your article has successfully passed the double-blind peer review process 
          and has been <strong>ACCEPTED</strong> for official publication in 
          <strong>The National Review of Sciences for Students</strong>.
        </p>
      </div>
    `;
  
  // Información adicional
  const additionalInfo = isSpanish
    ? `
      <p>El certificado oficial de aceptación está disponible para su descarga inmediata a través del siguiente enlace. 
      Este documento incluye un código QR de verificación que puede ser utilizado para autenticar la validez del certificado.</p>
      
      <p><strong>Información importante:</strong></p>
      <ul style="text-align: left; margin: 20px 0; padding-left: 20px; color: #333;">
        <li>El certificado contiene un código QR único de verificación</li>
        <li>Puede compartir este certificado con su institución o empleador</li>
        <li>El artículo será publicado bajo la modalidad <em>Online First</em></li>
        <li>Se le notificará cuando el artículo esté disponible en línea</li>
      </ul>
    `
    : `
      <p>The official acceptance certificate is available for immediate download through the link below. 
      This document includes a verification QR code that can be used to authenticate the validity of the certificate.</p>
      
      <p><strong>Important information:</strong></p>
      <ul style="text-align: left; margin: 20px 0; padding-left: 20px; color: #333;">
        <li>The certificate contains a unique verification QR code</li>
        <li>You can share this certificate with your institution or employer</li>
        <li>The article will be published under the <em>Online First</em> modality</li>
        <li>You will be notified when the article is available online</li>
      </ul>
    `;
  
  // Cuerpo completo del email
  const emailBody = `
    ${congratulationMessage}
    
    ${articleDetails}
    
    ${downloadButton}
    
    ${additionalInfo}
  `;
  
  // Usar getEmailTemplate para el diseño institucional
  const htmlBody = getEmailTemplate(
    emailTitle,
    isSpanish ? 'Estimado/a autor/a:' : 'Dear Author:',
    emailBody,
    isSpanish ? 'Equipo Editorial' : 'Editorial Team',
    isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
    lang
  );
  
  // Enviar email con el diseño institucional
  await sendEmailViaExtension(to, emailTitle, htmlBody);
}

/* ===================== FUNCIÓN: SANITIZAR TEXTO ===================== */
/**
 * Sanitiza texto para prevenir inyección HTML
 * @param {string} text - Texto a sanitizar
 * @returns {string} - Texto sanitizado
 */
function sanitizeText(text) {
  if (!text) return '';
  
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/* ===================== INVITAR REVISOR EXTERNO (CORREGIDO CON EDITORIAL TASK ID) ===================== */
exports.createExternalReviewerInvitation = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  const functionStartTime = Date.now();
  const requestId = `EXT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  
  console.log('='.repeat(60));
  console.log(`🚀 [${requestId}] createExternalReviewerInvitation INICIO - ${new Date().toISOString()}`);
  
  try {
    // --- VALIDACIÓN 1: Autenticación ---
    if (!request.auth) {
      console.error(`[${requestId}] ❌ Usuario no autenticado`);
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión / You must be logged in');
    }
    
    const callerUid = request.auth.uid;
    console.log(`[${requestId}] 👤 Usuario: ${callerUid}`);
    
    // --- VALIDACIÓN 2: Datos requeridos ---
    const { 
      submissionId, 
      reviewerName, 
      reviewerEmail, 
      institution = '', 
      position = '', 
      area = '', 
      message = '',
      language = 'es',
      editorialTaskId = null,  // ✅ NUEVO: Recibir editorialTaskId
      round = 1                 // ✅ NUEVO: Recibir round
    } = request.data;
    
    const isSpanish = language === 'es';
    
    if (!submissionId || !reviewerName || !reviewerEmail) {
      console.error(`[${requestId}] ❌ Faltan campos requeridos`);
      throw new HttpsError(
        'invalid-argument', 
        isSpanish 
          ? 'Faltan campos requeridos: submissionId, reviewerName, reviewerEmail' 
          : 'Missing required fields: submissionId, reviewerName, reviewerEmail'
      );
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reviewerEmail)) {
      throw new HttpsError(
        'invalid-argument',
        isSpanish ? 'Email inválido' : 'Invalid email'
      );
    }
    
    // Sanitizar inputs
    const sanitizedName = reviewerName.trim().replace(/<[^>]*>/g, '');
    const sanitizedEmail = reviewerEmail.trim().toLowerCase();
    const sanitizedInstitution = institution.trim().replace(/<[^>]*>/g, '');
    const sanitizedPosition = position.trim().replace(/<[^>]*>/g, '');
    const sanitizedArea = area.trim().replace(/<[^>]*>/g, '');
    const sanitizedMessage = message.trim().replace(/<[^>]*>/g, '');
    
    console.log(`[${requestId}] 📝 Datos:`, {
      submissionId,
      editorialTaskId,
      round,
      reviewerName: sanitizedName,
      reviewerEmail: sanitizedEmail,
      language
    });
    
    // --- VALIDACIÓN 3: Permisos del editor ---
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(callerUid).get();
    
    if (!userDoc.exists) {
      console.error(`[${requestId}] ❌ Usuario no encontrado`);
      throw new HttpsError(
        'not-found', 
        isSpanish ? 'Usuario no encontrado' : 'User not found'
      );
    }
    
    const userData = userDoc.data();
    const hasEditorPermission = ['Editor de Sección', 'Editor en Jefe', 'Director General', 'Encargado de Asignación de Artículos']
      .some(role => (userData.roles || []).includes(role));
    
    if (!hasEditorPermission) {
      console.error(`[${requestId}] ❌ Sin permisos de editor`);
      throw new HttpsError(
        'permission-denied', 
        isSpanish 
          ? 'No tienes permisos para invitar revisores' 
          : 'You do not have permission to invite reviewers'
      );
    }
    
    // --- VALIDACIÓN 4: Verificar submission ---
    const submissionDoc = await db.collection('submissions').doc(submissionId).get();
    
    if (!submissionDoc.exists) {
      console.error(`[${requestId}] ❌ Submission no encontrado: ${submissionId}`);
      throw new HttpsError(
        'not-found', 
        isSpanish ? 'Submission no encontrado' : 'Submission not found'
      );
    }
    
    const submission = submissionDoc.data();
    console.log(`[${requestId}] 📄 Submission: "${submission.title || submissionId}"`);
    
    // --- VERIFICAR INVITACIONES EXISTENTES ---
    const existingInvitations = await db.collection('reviewerInvitations')
      .where('submissionId', '==', submissionId)
      .where('reviewerEmail', '==', sanitizedEmail)
      .where('status', 'in', ['pending', 'accepted'])
      .limit(1)
      .get();
    
    if (!existingInvitations.empty) {
      const existingInv = existingInvitations.docs[0];
      const existingStatus = existingInv.data().status;
      console.warn(`[${requestId}] ⚠️ Ya existe invitación ${existingStatus}: ${existingInv.id}`);
      
      throw new HttpsError(
        'already-exists',
        existingStatus === 'accepted'
          ? (isSpanish 
              ? 'Este revisor ya aceptó revisar este artículo' 
              : 'This reviewer has already accepted to review this article')
          : (isSpanish 
              ? 'Ya existe una invitación pendiente para este revisor' 
              : 'A pending invitation already exists for this reviewer')
      );
    }
    
    // --- GENERAR TOKENS ---
    const crypto = require('crypto');
    const onboardingToken = crypto.randomBytes(32).toString('hex');
    const inviteHash = crypto.randomBytes(16).toString('hex');
    const tokenExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
    
    console.log(`[${requestId}] 🔐 Tokens generados`);
    
    // --- CREAR DOCUMENTO DE INVITACIÓN ---
    const invitationData = {
      submissionId,
      editorialTaskId: editorialTaskId || null,  // ✅ AGREGAR
      round: round || 1,                           // ✅ AGREGAR
      reviewerEmail: sanitizedEmail,
      reviewerName: sanitizedName,
      institution: sanitizedInstitution,
      position: sanitizedPosition,
      area: sanitizedArea,
      invitedByUid: callerUid,
      invitedByName: userData.displayName || userData.email,
      invitedByEmail: userData.email,
      inviteHash,
      onboardingToken,
      tokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiryDate),
      status: 'pending',
      type: 'external',
      language: language || 'es',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      prefillData: {
        name: sanitizedName,
        email: sanitizedEmail,
        institution: sanitizedInstitution,
        position: sanitizedPosition,
        area: sanitizedArea
      }
    };
    
    const invitationRef = await db.collection('reviewerInvitations').add(invitationData);
    
    console.log(`[${requestId}] ✅ Invitación creada: ${invitationRef.id}`);
    console.log(`[${requestId}] 📋 editorialTaskId: ${editorialTaskId || 'NO ASIGNADO'}`);
    
    // --- CONSTRUIR LINK ---
    const baseUrl = 'https://www.revistacienciasestudiantes.com';
    const onboardingLink = `${baseUrl}/reviewer-onboarding?token=${onboardingToken}&lang=${language}`;
    
    // --- ENVIAR EMAIL ---
    console.log(`[${requestId}] 📧 Enviando email...`);
    
    const emailSubject = isSpanish
      ? '📋 Invitación a ser Revisor - Revista de Ciencias'
      : '📋 Reviewer Invitation - Science Journal';
    
    const greeting = isSpanish
      ? `Estimado/a ${sanitizedName}:`
      : `Dear ${sanitizedName}:`;
    
    const intro = isSpanish
      ? `<p>${sanitizeText(userData.displayName || userData.email)} te ha invitado a ser revisor/a para la <strong>Revista Nacional de las Ciencias para Estudiantes</strong>.</p>`
      : `<p>${sanitizeText(userData.displayName || userData.email)} has invited you to be a reviewer for <strong>The National Review of Sciences for Students</strong>.</p>`;
    
    const articleInfo = `
      <div class="highlight-box">
        <p class="article-title">"${sanitizeText(submission.title || (isSpanish ? 'Sin título' : 'Untitled'))}"</p>
        <p><strong>${isSpanish ? 'Área:' : 'Area:'}</strong> ${sanitizeText(submission.area || (isSpanish ? 'No especificada' : 'Not specified'))}</p>
        ${submission.abstract ? `<p><strong>${isSpanish ? 'Resumen:' : 'Abstract:'}</strong> ${sanitizeText(submission.abstract.substring(0, 200))}${submission.abstract.length > 200 ? '...' : ''}</p>` : ''}
      </div>
    `;
    
    const customMessageSection = sanitizedMessage
      ? `
        <div class="highlight-box" style="background-color: #f0f7ff; border-left-color: #0A1929;">
          <p><strong>${isSpanish ? 'Mensaje personal de' : 'Personal message from'} ${sanitizeText(userData.displayName || userData.email)}:</strong></p>
          <p style="font-style: italic;">"${sanitizeText(sanitizedMessage)}"</p>
        </div>
      `
      : '';
    
    const instructions = isSpanish
      ? `
        <p>Para comenzar, simplemente haz clic en el siguiente enlace y sigue los pasos:</p>
        <ol style="text-align: left; margin: 20px 0; padding-left: 20px;">
          <li><strong>Crear tu cuenta</strong> con una contraseña</li>
          <li><strong>Configurar tu disponibilidad</strong> como revisor</li>
          <li><strong>Acceder directamente</strong> al panel de revisión</li>
        </ol>
        <p>Todo el proceso toma menos de 2 minutos.</p>
      `
      : `
        <p>To get started, simply click the link below and follow the steps:</p>
        <ol style="text-align: left; margin: 20px 0; padding-left: 20px;">
          <li><strong>Create your account</strong> with a password</li>
          <li><strong>Set up your availability</strong> as a reviewer</li>
          <li><strong>Access directly</strong> the review panel</li>
        </ol>
        <p>The entire process takes less than 2 minutes.</p>
      `;
    
    const buttonText = isSpanish ? 'COMENZAR AHORA' : 'GET STARTED NOW';
    
    const expiryWarning = isSpanish
      ? '<p style="font-size: 12px; color: #666;"><strong>Este enlace expira en 7 días.</strong></p>'
      : '<p style="font-size: 12px; color: #666;"><strong>This link expires in 7 days.</strong></p>';
    
    const emailBody = `
      ${intro}
      ${articleInfo}
      ${customMessageSection}
      ${instructions}
      <div class="button-container">
        <a href="${onboardingLink}" class="btn">${buttonText}</a>
      </div>
      ${expiryWarning}
    `;
    
    const htmlBody = getEmailTemplate(
      emailSubject,
      greeting,
      emailBody,
      isSpanish ? 'Equipo Editorial' : 'Editorial Team',
      isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
      language
    );
    
    await sendEmailViaExtension(
      sanitizedEmail,
      emailSubject,
      htmlBody
    ).catch(emailError => {
      console.error(`[${requestId}] ❌ Error email:`, emailError.message);
      throw new HttpsError(
        'internal', 
        isSpanish 
          ? 'Error al enviar el email de invitación' 
          : 'Error sending invitation email'
      );
    });
    
    // --- ACTUALIZAR INVITACIÓN ---
    await invitationRef.update({
      onboardingLink,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      emailSent: true
    });
    
    // --- AUDIT LOG ---
    await submissionDoc.ref.collection('auditLogs').add({
      action: 'external_reviewer_invited',
      by: callerUid,
      byName: userData.displayName || userData.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        invitationId: invitationRef.id,
        editorialTaskId: editorialTaskId || null,  // ✅ AGREGAR
        round: round || 1,                           // ✅ AGREGAR
        reviewerEmail: sanitizedEmail,
        reviewerName: sanitizedName,
        institution: sanitizedInstitution,
        position: sanitizedPosition,
        language
      }
    });
    
    const totalTime = Date.now() - functionStartTime;
    console.log(`[${requestId}] ✅ Completado en ${totalTime}ms`);
    console.log('='.repeat(60));
    
    return {
      success: true,
      invitationId: invitationRef.id,
      onboardingLink,
      editorialTaskId: editorialTaskId || null,  // ✅ AGREGAR
      round: round || 1,                           // ✅ AGREGAR
      message: isSpanish ? 'Invitación enviada exitosamente' : 'Invitation sent successfully'
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);
    console.log('='.repeat(60));
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', error.message);
  }
});
/* ===================== VERIFICAR TOKEN DE INVITACIÓN ===================== */
exports.verifyReviewerToken = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  
  try {
    const { token, language = 'es' } = request.data;
    const isSpanish = language === 'es';
    
    if (!token) {
      throw new HttpsError(
        'invalid-argument', 
        isSpanish ? 'Token requerido' : 'Token required'
      );
    }
    
    const db = admin.firestore();
    
    const invitationQuery = await db.collection('reviewerInvitations')
      .where('onboardingToken', '==', token)
      .limit(1)
      .get();
    
    if (invitationQuery.empty) {
      return {
        success: false,
        error: isSpanish ? 'Token no válido' : 'Invalid token'
      };
    }
    
    const invitationDoc = invitationQuery.docs[0];
    const invitationData = invitationDoc.data();
    
    // Verificar expiración
    if (invitationData.tokenExpiresAt) {
      const expiryDate = invitationData.tokenExpiresAt.toDate();
      if (expiryDate < new Date()) {
        return {
          success: false,
          error: isSpanish ? 'La invitación ha expirado' : 'The invitation has expired'
        };
      }
    }
    
    // Verificar si ya fue completado
    if (invitationData.onboardingCompleted) {
      return {
        success: false,
        error: isSpanish ? 'Invitación ya completada' : 'Invitation already completed'
      };
    }
    
    return {
      success: true,
      invitation: {
        id: invitationDoc.id,
        submissionId: invitationData.submissionId,
        reviewerEmail: invitationData.reviewerEmail,
        reviewerName: invitationData.reviewerName,
        prefillData: invitationData.prefillData || {},
        language: invitationData.language || 'es'
      }
    };
    
  } catch (error) {
    console.error('Error verificando token:', error);
    throw new HttpsError('internal', error.message);
  }
});
/* ===================== COMPLETAR ONBOARDING DEL REVISOR (CORREGIDO) ===================== */
exports.completeReviewerOnboarding = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  const functionStartTime = Date.now();
  const requestId = `ONB-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  
  console.log('='.repeat(60));
  console.log(`🚀 [${requestId}] completeReviewerOnboarding INICIO - ${new Date().toISOString()}`);
  
  try {
    // --- VALIDACIÓN 1: Datos requeridos ---
    const { 
      token, 
      name, 
      email, 
      password, 
      institution = '', 
      position = '', 
      area = '',
      language = 'es'
    } = request.data;
    
    const isSpanish = language === 'es';
    
    if (!token || !name || !email || !password) {
      console.error(`[${requestId}] ❌ Faltan campos requeridos`);
      throw new HttpsError(
        'invalid-argument', 
        isSpanish 
          ? 'Faltan campos requeridos: token, name, email, password' 
          : 'Missing required fields: token, name, email, password'
      );
    }
    
    if (password.length < 6) {
      throw new HttpsError(
        'invalid-argument', 
        isSpanish 
          ? 'La contraseña debe tener al menos 6 caracteres' 
          : 'Password must be at least 6 characters'
      );
    }
    
    const sanitizedName = name.trim().replace(/<[^>]*>/g, '');
    const sanitizedEmail = email.trim().toLowerCase();
    
    console.log(`[${requestId}] 📝 Datos:`, {
      token: token.substring(0, 16) + '...',
      name: sanitizedName,
      email: sanitizedEmail
    });
    
    const db = admin.firestore();
    
    // --- PASO 1: Verificar token ---
    console.log(`[${requestId}] 🔍 Verificando token...`);
    
    const invitationQuery = await db.collection('reviewerInvitations')
      .where('onboardingToken', '==', token)
      .limit(1)
      .get();
    
    if (invitationQuery.empty) {
      console.error(`[${requestId}] ❌ Token no encontrado`);
      throw new HttpsError(
        'not-found', 
        isSpanish ? 'Token de invitación no válido' : 'Invalid invitation token'
      );
    }
    
    const invitationDoc = invitationQuery.docs[0];
    const invitationData = invitationDoc.data();
    
    console.log(`[${requestId}] ✅ Invitación encontrada: ${invitationDoc.id}`);
    console.log(`[${requestId}] 📋 Datos de invitación:`, {
      submissionId: invitationData.submissionId,
      editorialTaskId: invitationData.editorialTaskId || 'NO TIENE',
      round: invitationData.round || 1,
      type: invitationData.type || 'internal'
    });
    
    // --- PASO 2: Verificar expiración ---
    if (invitationData.tokenExpiresAt) {
      const expiryDate = invitationData.tokenExpiresAt.toDate();
      if (expiryDate < new Date()) {
        console.error(`[${requestId}] ❌ Token expirado`);
        throw new HttpsError(
          'deadline-exceeded', 
          isSpanish 
            ? 'La invitación ha expirado. Por favor contacta al editor.' 
            : 'The invitation has expired. Please contact the editor.'
        );
      }
    }
    
    // --- PASO 3: Verificar email ---
    if (invitationData.reviewerEmail !== sanitizedEmail) {
      console.error(`[${requestId}] ❌ Email no coincide`);
      throw new HttpsError(
        'invalid-argument', 
        isSpanish 
          ? 'El email no coincide con la invitación' 
          : 'Email does not match the invitation'
      );
    }
    
    // --- PASO 4: Verificar si ya fue completado ---
    if (invitationData.onboardingCompleted) {
      console.warn(`[${requestId}] ⚠️ Invitación ya completada`);
      throw new HttpsError(
        'already-exists', 
        isSpanish 
          ? 'Esta invitación ya fue completada' 
          : 'This invitation has already been completed'
      );
    }
    
    // --- PASO 5: Crear/actualizar usuario en Auth ---
    console.log(`[${requestId}] 👤 Creando usuario en Auth...`);
    
    let userRecord;
    
    try {
      userRecord = await admin.auth().createUser({
        email: sanitizedEmail,
        password: password,
        displayName: sanitizedName,
        emailVerified: true
      });
      console.log(`[${requestId}] ✅ Usuario creado: ${userRecord.uid}`);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log(`[${requestId}] ℹ️ Usuario existente, actualizando...`);
        const existingUser = await admin.auth().getUserByEmail(sanitizedEmail);
        userRecord = existingUser;
        
        if (!existingUser.providerData.some(p => p.providerId !== 'password')) {
          await admin.auth().updateUser(existingUser.uid, {
            password: password,
            displayName: sanitizedName,
            emailVerified: true
          });
          console.log(`[${requestId}] ✅ Usuario actualizado: ${existingUser.uid}`);
        }
      } else {
        throw authError;
      }
    }
    
    // --- TRANSACCIÓN EN FIRESTORE ---
    console.log(`[${requestId}] 💾 Guardando en Firestore...`);
    
    let assignmentId = null;
    
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userRecord.uid);
      const userDoc = await transaction.get(userRef);
      
      const baseUserData = {
        uid: userRecord.uid,
        email: sanitizedEmail,
        firstName: sanitizedName.split(' ')[0] || '',
        lastName: sanitizedName.split(' ').slice(1).join(' ') || '',
        displayName: sanitizedName,
        institution: institution,
        position: position,
        area: area,
        publicEmail: sanitizedEmail,
        externalReviewer: true,
        invitedVia: invitationDoc.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (userDoc.exists) {
        // Usuario existente
        const existingRoles = userDoc.data().roles || [];
        if (!existingRoles.includes('Revisor')) {
          baseUserData.roles = [...existingRoles, 'Revisor'];
        }
        transaction.update(userRef, baseUserData);
      } else {
        // Usuario nuevo
        baseUserData.roles = ['Revisor'];
        baseUserData.description = { es: '', en: '' };
        baseUserData.interests = { es: [], en: [] };
        baseUserData.imageUrl = '';
        baseUserData.social = {};
        baseUserData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(userRef, baseUserData);
      }
      
      // Actualizar invitación
      transaction.update(invitationDoc.ref, {
        status: 'accepted',
        reviewerUid: userRecord.uid,
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        onboardingCompleted: true,
        onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Crear asignación de revisión
      if (invitationData.submissionId) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 21);
        
        const assignmentRef = db.collection('reviewerAssignments').doc();
        assignmentId = assignmentRef.id;
        
        // ✅ CORRECCIÓN CLAVE: Propagar editorialTaskId desde la invitación
        const assignmentData = {
          submissionId: invitationData.submissionId,
          round: invitationData.round || 1,
          reviewerUid: userRecord.uid,
          reviewerEmail: sanitizedEmail,
          reviewerName: sanitizedName,
          invitationId: invitationDoc.id,
          status: 'assigned',
          conflictOfInterest: invitationData.conflictOfInterest || false,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          dueDate: admin.firestore.Timestamp.fromDate(dueDate),
          isExternal: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // ✅ AGREGAR editorialTaskId si existe en la invitación
        if (invitationData.editorialTaskId) {
          assignmentData.editorialTaskId = invitationData.editorialTaskId;
          console.log(`[${requestId}] ✅ editorialTaskId propagado: ${invitationData.editorialTaskId}`);
        } else {
          console.warn(`[${requestId}] ⚠️ La invitación NO tiene editorialTaskId`);
        }
        
        transaction.set(assignmentRef, assignmentData);
      }
    });
    
    console.log(`[${requestId}] ✅ Firestore actualizado. AssignmentId: ${assignmentId}`);
    
    // --- AUDIT LOG ---
    if (invitationData.submissionId) {
      await db.collection('submissions')
        .doc(invitationData.submissionId)
        .collection('auditLogs')
        .add({
          action: 'external_reviewer_onboarded',
          by: userRecord.uid,
          byName: sanitizedName,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          details: {
            invitationId: invitationDoc.id,
            assignmentId: assignmentId,
            editorialTaskId: invitationData.editorialTaskId || null,
            reviewerEmail: sanitizedEmail,
            reviewerName: sanitizedName
          }
        });
    }
    
    const totalTime = Date.now() - functionStartTime;
    console.log(`[${requestId}] ✅ Completado en ${totalTime}ms`);
    console.log('='.repeat(60));
    
    return {
      success: true,
      uid: userRecord.uid,
      invitationId: invitationDoc.id,
      submissionId: invitationData.submissionId,
      assignmentId: assignmentId,
      editorialTaskId: invitationData.editorialTaskId || null,
      message: isSpanish ? 'Cuenta creada exitosamente' : 'Account created successfully'
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);
    console.log('='.repeat(60));
    
    try {
      await admin.firestore().collection('systemErrors').add({
        function: 'completeReviewerOnboarding',
        error: { 
          message: error.message, 
          stack: error.stack,
          code: error.code || 'UNKNOWN'
        },
        requestId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (logError) {
      console.error(`❌ Error al registrar error:`, logError.message);
    }
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', error.message);
  }
});

/* ===================== GUARDAR PERFIL DE REVISOR (ACTUALIZADO - SOLO COLECCIÓN reviewers) ===================== */
exports.saveReviewerProfile = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión / You must be logged in');
    }
    
    const { token, profile, language = 'es' } = request.data;
    const isSpanish = language === 'es';
    
    if (!token || !profile) {
      throw new HttpsError(
        'invalid-argument', 
        isSpanish ? 'Faltan datos requeridos' : 'Missing required data'
      );
    }
    
    const db = admin.firestore();
    
    // Verificar token
    const invitationQuery = await db.collection('reviewerInvitations')
      .where('onboardingToken', '==', token)
      .where('reviewerUid', '==', request.auth.uid)
      .limit(1)
      .get();
    
    if (invitationQuery.empty) {
      throw new HttpsError(
        'not-found', 
        isSpanish ? 'Invitación no encontrada' : 'Invitation not found'
      );
    }
    
    const invitationDoc = invitationQuery.docs[0];
    const invitationData = invitationDoc.data();
    
    // Preparar datos de áreas de expertise
    const areasOfExpertise = (profile.areasOfExpertise || []).slice(0, 5);
    const availability = profile.availability || 'medium';
    const maxConcurrentReviews = profile.maxReviews || 2;
    const reviewedBefore = profile.reviewedBefore || false;
    const orcid = profile.orcid || '';
    const preferredLanguage = profile.preferredLanguage || language;
    const timeAvailablePerReview = profile.timeAvailablePerReview || '2-weeks';
    const status = profile.status || 'active';
    const statusReason = profile.statusReason || '';
    
    // ============ GUARDAR EN COLECCIÓN `reviewers` ============
    const reviewerRef = db.collection('reviewers').doc(request.auth.uid);
    
    await reviewerRef.set({
      uid: request.auth.uid,
      email: invitationData.reviewerEmail || request.auth.token.email,
      name: invitationData.reviewerName || request.auth.token.name || '',
      firstName: (invitationData.reviewerName || '').split(' ')[0] || '',
      lastName: (invitationData.reviewerName || '').split(' ').slice(1).join(' ') || '',
      displayName: invitationData.reviewerName || '',
      institution: invitationData.prefillData?.institution || '',
      position: invitationData.prefillData?.position || '',
      areasOfExpertise: areasOfExpertise,
      availability: {
        maxActiveReviews: maxConcurrentReviews,
        currentActiveReviews: 1, // La invitación actual
        preferredLanguage: preferredLanguage,
        timeAvailablePerReview: timeAvailablePerReview,
        annualCapacity: availability
      },
      publicEmail: invitationData.reviewerEmail || '',
      orcid: orcid,
      reviewedBefore: reviewedBefore,
      status: status,
      statusReason: statusReason,
      statusChangedAt: new Date().toISOString(),
      isExternal: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      stats: {
        completedAssignments: 0,
        totalAssignments: 1,
        onTimeRate: 100,
        acceptanceRate: 100,
        averageReviewScore: 0,
        totalRoundsParticipated: 0
      }
    }, { merge: true });
    
    console.log(`✅ Perfil guardado en reviewers/${request.auth.uid} con ${areasOfExpertise.length} áreas de expertise`);
    
    // ============ ACTUALIZAR EN `users` ============
    await db.collection('users').doc(request.auth.uid).update({
      institution: invitationData.prefillData?.institution || '',
      publicEmail: invitationData.reviewerEmail || '',
      orcid: orcid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // ============ ACTUALIZAR INVITACIÓN ============
    await invitationDoc.ref.update({
      profileCompleted: true,
      profileCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      areasOfExpertise: areasOfExpertise,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      areasSaved: areasOfExpertise.length,
      message: isSpanish 
        ? `Perfil guardado exitosamente con ${areasOfExpertise.length} áreas de especialización` 
        : `Profile saved successfully with ${areasOfExpertise.length} areas of expertise`
    };
    
  } catch (error) {
    console.error('Error guardando perfil:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', error.message);
  }
});