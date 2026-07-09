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
let cachedDeepSeekFetch = null; // NUEVO: Cache para DeepSeek

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

/* ===================== DEEPSEEK (PRINCIPAL) ===================== */
async function getDeepSeekFetch() {
  if (!fetch) throw new Error("fetch no está disponible");
  
  if (!cachedDeepSeekFetch) {
    const apiKey = DEEPSEEK_API_KEY.value();
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY no configurada");
    
    // Configurar fetch con los agentes HTTP/HTTPS
    cachedDeepSeekFetch = async (url, options = {}) => {
      const fetchOptions = {
        ...options,
        agent: url.startsWith('https') ? httpsAgent : httpAgent
      };
      return fetch(url, fetchOptions);
    };
  }
  return cachedDeepSeekFetch;
}

async function callDeepSeek(prompt, temperature = 0) {
  console.log("🤖 Intentando con DeepSeek (modelo: tngtech/deepseek-r1t2-chimera)");
  
  try {
    const deepseekFetch = await getDeepSeekFetch();
    const apiKey = DEEPSEEK_API_KEY.value();
    
    const response = await deepseekFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.revistacienciasestudiantes.com",
        "X-Title": "Revista Nacional de Ciencias para Estudiantes"
      },
      body: JSON.stringify({
        model: "tngtech/deepseek-r1t2-chimera",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    let text = data.choices[0]?.message?.content?.trim() || "";
    
    // Limpiar marcadores de código si existen
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    
    console.log("✅ DeepSeek respondió exitosamente");
    return text;
    
  } catch (error) {
    console.error("❌ Error con DeepSeek:", error.message);
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
  
  // Intentar primero con DeepSeek
  try {
    const result = await callDeepSeek(prompt, temperature);
    console.log("✅ Traducción completada con DeepSeek");
    return result;
  } catch (deepseekError) {
    console.log("🔄 DeepSeek falló, intentando con Gemini fallback...", deepseekError.message);
    
    // Si DeepSeek falla, intentar con Gemini
    try {
      const result = await callGemini(prompt, temperature);
      console.log("✅ Traducción completada con Gemini fallback");
      return result;
    } catch (geminiError) {
      // Si ambos fallan, lanzar error
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
      const bodyTarget = await translateHtmlFragmentWithSplit(bodySource, source, target);

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
          doi: article.doi !== undefined ? article.doi : oldArticle.doi,
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
    
    const authorsArray = processAuthors(article.autores);
    articleNumber = await getNextArticleNumber(currentArticles);
    
    // Crear nuevo artículo
    const newArticle = {
      numeroArticulo: articleNumber,
      doi: article.doi || '',
      titulo: article.titulo,
      tituloEnglish: article.tituloEnglish || '',
      autores: authorsArray,
      resumen: article.resumen || '',
      abstract: article.abstract || '',
      palabras_clave: Array.isArray(article.palabras_clave) ? article.palabras_clave : 
                      (article.palabras_clave ? article.palabras_clave.split(';').map(k => k.trim()) : []),
      keywords_english: Array.isArray(article.keywords_english) ? article.keywords_english :
                       (article.keywords_english ? article.keywords_english.split(';').map(k => k.trim()) : []),
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
    
    let authorsArray;
    if (article.autores) {
      authorsArray = processAuthors(article.autores);
    } else {
      authorsArray = oldArticle.autores || [];
    }
    
    const updatedArticle = {
      ...oldArticle,
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

// ===================== FUNCIÓN AUXILIAR PARA CREAR HISTORIAL INMUTABLE (SIN DOI) =====================
async function createImmutableArticleHistory(article, user, action, requestId) {
  try {
    const db = admin.firestore();
    const crypto = require('crypto');
    
    console.log(`[${requestId}] 📦 Construyendo objeto de historial inmutable...`);
    
    // 1. Buscar si ya existe un historial para este artículo
    const existingHistoryQuery = await db.collection('immutableHistories')
      .where('articleNumber', '==', article.numeroArticulo)
      .orderBy('control.createdAt', 'desc')
      .limit(1)
      .get();
    
    let previousHistoryId = null;
    if (!existingHistoryQuery.empty) {
      previousHistoryId = existingHistoryQuery.docs[0].id;
      console.log(`[${requestId}] 📚 Versión anterior encontrada: ${previousHistoryId}`);
    }
    
    // 2. Procesar autores para formato final
    const processedAuthors = (article.autores || []).map(author => {
      return {
        name: author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim(),
        authorId: author.authorId || null,
        email: author.email || null,
        institution: author.institution || null,
        orcid: author.orcid || null,
        fullName: author.name || `${author.firstName || ''} ${author.lastName || ''}`.trim()
      };
    });
    
    // 3. Construir el objeto de historia (SIN DOI)
    const immutableHistory = {
      version: "1.0.0",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: user.uid,
      createdByEmail: user.email || 'unknown',
      createdByAction: action,
      requestId: requestId,
      
      // Identificadores del artículo
      articleNumber: article.numeroArticulo,
      submissionId: article.submissionId || null,
      
      // METADATOS FINALES DEL ARTÍCULO (SIN DOI)
      finalMetadata: {
        title: article.titulo,
        titleEn: article.tituloEnglish || '',
        doi: article.doi || '',
        authors: processedAuthors,
        abstract: article.resumen || '',
        abstractEn: article.abstract || '',
        keywords: article.palabras_clave || [],
        keywordsEn: article.keywords_english || [],
        area: article.area || '',
        tipo: article.tipo || 'Artículo de Investigación',
        type: article.type || 'Research Article',
        fecha: article.fecha || '',
        receivedDate: article.receivedDate || '',
        acceptedDate: article.acceptedDate || '',
        publication: {
          volumen: article.volumen || '',
          numero: article.numero || '',
          primeraPagina: article.primeraPagina || '',
          ultimaPagina: article.ultimaPagina || '',
          pdfUrl: article.pdfUrl || ''
          // SIN DOI
        },
        acknowledgments: article.acknowledgments || '',
        acknowledgmentsEnglish: article.acknowledgmentsEnglish || '',
        funding: article.funding || 'No declarada',
        fundingEnglish: article.fundingEnglish || 'Not declared',
        conflicts: article.conflicts || 'Los autores declaran no tener conflictos de interés.',
        conflictsEnglish: article.conflictsEnglish || 'The authors declare no conflicts of interest.',
        authorCredits: article.authorCredits || '',
        authorCreditsEnglish: article.authorCreditsEnglish || '',
        dataAvailability: article.dataAvailability || '',
        dataAvailabilityEnglish: article.dataAvailabilityEnglish || '',
        html_es: article.html_es || '',
        html_en: article.html_en || '',
        referencias: article.referencias || ''
      },
      
      // INFORMACIÓN DE CONTROL
      control: {
        createdBy: user.uid,
        createdByEmail: user.email,
        createdAt: new Date().toISOString(),
        lastAction: action,
        previousHistoryId: previousHistoryId,
        isLatest: true,
        articleStatus: article.status || 'published'
      },
      
      // HASH (se calculará después)
      hash: null,
      
      previousVersions: previousHistoryId ? [previousHistoryId] : []
    };
    
    // 4. Si existe un historial anterior, marcarlo como no latest
    if (previousHistoryId) {
      await db.collection('immutableHistories').doc(previousHistoryId).update({
        'control.isLatest': false,
        'control.supersededBy': null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // 5. Calcular hash SHA-256
    const hashObj = { ...immutableHistory };
    delete hashObj.hash;
    delete hashObj.createdAt; // Excluir timestamp de Firebase del hash
    
    const hashString = JSON.stringify(hashObj, (key, value) => {
      if (value && typeof value === 'object' && value.toDate) {
        return value.toDate().toISOString();
      }
      return value;
    });
    
    immutableHistory.hash = crypto
      .createHash('sha256')
      .update(hashString)
      .digest('hex');
    
    // 6. Guardar en Firestore
    let historyRef;
    if (previousHistoryId) {
      historyRef = await db.collection('immutableHistories').add(immutableHistory);
      
      // Actualizar el anterior con la referencia al nuevo
      await db.collection('immutableHistories').doc(previousHistoryId).update({
        'control.supersededBy': historyRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      historyRef = await db.collection('immutableHistories').add(immutableHistory);
    }
    
    console.log(`[${requestId}] ✅ Historial guardado con ID: ${historyRef.id}`);
    
    return {
      historyId: historyRef.id,
      hash: immutableHistory.hash,
      articleNumber: article.numeroArticulo
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error en createImmutableArticleHistory:`, error);
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
/* ===================== PROCESAR DOCUMENTO CON GOOGLE DOCS API ===================== */

/**
 * Procesa el documento Word subido:
 * 1. Lo convierte a Google Docs
 * 2. Elimina metadatos del autor
 * 3. Aplica estilos profesionales
 * 4. Añade portada institucional
 * 5. Inserta marca de agua
 */
// ============================================================
// 1. IMPORTS
// ============================================================
const { Readable } = require('stream');

// ============================================================
// CONFIGURACIÓN GLOBAL - DEFINIDA FUERA PARA ACCESO GLOBAL
// ============================================================
const CONFIG = {
  COLORS: {
    academicBlue: { red: 0.0, green: 0.15, blue: 0.35 },
    darkCharcoal: { red: 0.08, green: 0.08, blue: 0.08 },
    bodyGray: { red: 0.15, green: 0.15, blue: 0.15 },
    metadataGray: { red: 0.08, green: 0.08, blue: 0.08 },  // ← Mismo que darkCharcoal
    academicRed: { red: 0.5, green: 0.0, blue: 0.0 }
  },
  
  TYPOGRAPHY: {
    journalName: { family: 'Open Sans', weight: 600, size: 10 },
    journalSubtitle: { family: 'Open Sans', weight: 400, size: 9 },
    articleTitle: { family: 'Lora', weight: 700, size: 22 },
    metadata: { family: 'Open Sans', weight: 400, size: 9 },
    metadataLabel: { family: 'Open Sans', weight: 600, size: 9 },
    body: { family: 'Lora', weight: 400, size: 11 },
    confidential: { family: 'Open Sans', weight: 600, size: 8 }
  }
};

// ============================================================
// FUNCIÓN PRINCIPAL: PROCESAR DOCUMENTO (VERSIÓN SIMPLE)
// ============================================================
async function processDocumentWithDocsAPI(drive, docsClient, fileId, submissionData, requestId) {
  console.log(`[${requestId}] 📝 Iniciando procesamiento de documento (diseño simple)...`);
  
  const result = {
    success: true,
    docsFileId: null,
    docsFileUrl: null,
    pdfFileId: null,
    pdfFileUrl: null,
    warnings: [],
    errors: []
  };
  
  try {
    const submissionId = submissionData?.submissionId || requestId;
    const editorialFolderId = submissionData?.editorialFolderId || null;
    const authors = submissionData.authors || ['Autor no especificado'];
    const authorNames = Array.isArray(authors) ? authors.join(', ') : authors;
    const articleTitle = submissionData.title || 'Untitled';
    const articleType = (submissionData.articleType || 'RESEARCH ARTICLE').toUpperCase();
    const date = new Date().toLocaleDateString('es-CL');
    
    // ============================================================
    // PASO 1: CONVERTIR WORD A GOOGLE DOCS
    // ============================================================
    let docsFileId = null;
    
    try {
      const copyRequest = {
        fileId: fileId,
        requestBody: {
          name: `PROCESSED_${submissionId}`,
          mimeType: 'application/vnd.google-apps.document'
        },
        fields: 'id, webViewLink'
      };
      
      if (editorialFolderId) {
        copyRequest.requestBody.parents = [editorialFolderId];
      }
      
      const docsFile = await drive.files.copy(copyRequest);
      docsFileId = docsFile.data.id;
      result.docsFileId = docsFileId;
      result.docsFileUrl = docsFile.data.webViewLink;
      
      console.log(`[${requestId}] ✅ Google Docs creado: ${docsFileId}`);
      
      // Pequeña pausa para asegurar que el documento esté listo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      throw new Error(`Error creando documento: ${error.message}`);
    }
    
    // ============================================================
    // PASO 2: CONSTRUIR PORTADA SIMPLE Y CENTRADA
    // ============================================================
    const COLORS = CONFIG.COLORS;
    const TYPO = CONFIG.TYPOGRAPHY;
    
    // Texto de la portada con marcadores de estilo
    const coverText = [
      'REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES\n',
      'National Review of Sciences for Students\n',
      '\n',
      '──────────────────────────────────────────────────\n',
      '\n',
      articleTitle + '\n',
      '\n',
      `Submission ID: ${submissionId}\n`,
      `Article Type: ${articleType}\n`,
      `Date: ${date}\n`,
      '\n',
      '──────────────────────────────────────────────────\n',
      'CONFIDENTIAL DOCUMENT // FOR EDITORIAL REVIEW ONLY\n'
    ].join('');
    
    // ============================================================
    // PASO 3: GENERAR SOLICITUDES DE FORMATO
    // ============================================================
    const requests = [];
    
    // Insertar texto de la portada
    requests.push({
      insertText: {
        location: { index: 1 },
        text: coverText
      }
    });
    
    // Calcular posiciones para aplicar estilos
    let currentPos = 1;
    
    // 1. Nombre de la revista
    const journalText = 'REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES\n';
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + journalText.length },
        textStyle: {
          weightedFontFamily: { fontFamily: TYPO.journalName.family, weight: TYPO.journalName.weight },
          fontSize: { magnitude: TYPO.journalName.size, unit: 'PT' },
          bold: true,
          foregroundColor: { color: { rgbColor: COLORS.academicBlue } }
        },
        fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + journalText.length },
        paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 2, unit: 'PT' } },
        fields: 'alignment,spaceBelow'
      }
    });
    currentPos += journalText.length;
    
    // 2. Subtítulo en inglés
    const subtitleText = 'National Review of Sciences for Students\n';
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + subtitleText.length },
        textStyle: {
          weightedFontFamily: { fontFamily: TYPO.journalSubtitle.family, weight: TYPO.journalSubtitle.weight },
          fontSize: { magnitude: TYPO.journalSubtitle.size, unit: 'PT' },
          italic: true,
          foregroundColor: { color: { rgbColor: COLORS.metadataGray } }
        },
        fields: 'weightedFontFamily,fontSize,italic,foregroundColor'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + subtitleText.length },
        paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 12, unit: 'PT' } },
        fields: 'alignment,spaceBelow'
      }
    });
    currentPos += subtitleText.length;
    
    // 3. Espacio
    currentPos += '\n'.length;
    
    // 4. Línea decorativa superior
    const dividerText = '──────────────────────────────────────────────────\n';
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + dividerText.length },
        textStyle: {
          foregroundColor: { color: { rgbColor: COLORS.academicBlue } },
          fontSize: { magnitude: 6, unit: 'PT' }
        },
        fields: 'foregroundColor,fontSize'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + dividerText.length },
        paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 18, unit: 'PT' } },
        fields: 'alignment,spaceBelow'
      }
    });
    currentPos += dividerText.length;
    
    // 5. Espacio
    currentPos += '\n'.length;
    
    // 6. Título del artículo
    const titleText = articleTitle + '\n';
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + titleText.length },
        textStyle: {
          weightedFontFamily: { fontFamily: TYPO.articleTitle.family, weight: TYPO.articleTitle.weight },
          fontSize: { magnitude: TYPO.articleTitle.size, unit: 'PT' },
          bold: true,
          foregroundColor: { color: { rgbColor: COLORS.darkCharcoal } }
        },
        fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + titleText.length },
        paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 24, unit: 'PT' } },
        fields: 'alignment,spaceBelow'
      }
    });
    currentPos += titleText.length;
    
    // 7. Espacio
    currentPos += '\n'.length;
    
    // 8. Metadatos (aplicar estilo a cada línea)
    const metadataLines = [
      `Submission ID: ${submissionId}\n`,
      `Article Type: ${articleType}\n`,
      `Date: ${date}\n`
    ];
    
    for (const line of metadataLines) {
      // Buscar el punto y aparte para estilizar la etiqueta
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        // Estilo para la etiqueta (antes de los dos puntos)
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentPos, endIndex: currentPos + colonIndex + 1 },
            textStyle: {
              weightedFontFamily: { fontFamily: TYPO.metadataLabel.family, weight: TYPO.metadataLabel.weight },
              fontSize: { magnitude: TYPO.metadataLabel.size, unit: 'PT' },
              bold: true,
              foregroundColor: { color: { rgbColor: COLORS.academicBlue } }
            },
            fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
          }
        });
        
        // Estilo para el valor (después de los dos puntos)
        requests.push({
          updateTextStyle: {
            range: { startIndex: currentPos + colonIndex + 1, endIndex: currentPos + line.length },
            textStyle: {
              weightedFontFamily: { fontFamily: TYPO.metadata.family, weight: TYPO.metadata.weight },
              fontSize: { magnitude: TYPO.metadata.size, unit: 'PT' },
              foregroundColor: { color: { rgbColor: COLORS.bodyGray } }
            },
            fields: 'weightedFontFamily,fontSize,foregroundColor'
          }
        });
      }
      
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: currentPos, endIndex: currentPos + line.length },
          paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 4, unit: 'PT' } },
          fields: 'alignment,spaceBelow'
        }
      });
      
      currentPos += line.length;
    }
    
    // 9. Espacio
    currentPos += '\n'.length;
    
    // 10. Línea decorativa inferior
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + dividerText.length },
        textStyle: {
          foregroundColor: { color: { rgbColor: COLORS.academicBlue } },
          fontSize: { magnitude: 6, unit: 'PT' }
        },
        fields: 'foregroundColor,fontSize'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + dividerText.length },
        paragraphStyle: { alignment: 'CENTER', spaceBelow: { magnitude: 18, unit: 'PT' } },
        fields: 'alignment,spaceBelow'
      }
    });
    currentPos += dividerText.length;
    
    // 11. Texto confidencial
    const confidentialText = 'CONFIDENTIAL DOCUMENT // FOR EDITORIAL REVIEW ONLY\n';
    requests.push({
      updateTextStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + confidentialText.length },
        textStyle: {
          weightedFontFamily: { fontFamily: TYPO.confidential.family, weight: TYPO.confidential.weight },
          fontSize: { magnitude: TYPO.confidential.size, unit: 'PT' },
          foregroundColor: { color: { rgbColor: COLORS.academicRed } },
          bold: true
        },
        fields: 'weightedFontFamily,fontSize,foregroundColor,bold'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: currentPos, endIndex: currentPos + confidentialText.length },
        paragraphStyle: { alignment: 'CENTER', spaceAbove: { magnitude: 12, unit: 'PT' } },
        fields: 'alignment,spaceAbove'
      }
    });
    currentPos += confidentialText.length;
    
    // 12. Insertar salto de página
    requests.push({
      insertPageBreak: {
        location: { index: currentPos }
      }
    });
    
    // ============================================================
    // PASO 4: APLICAR TODOS LOS ESTILOS
    // ============================================================
    console.log(`[${requestId}] 🎨 Aplicando estilos (${requests.length} solicitudes)...`);
    
    await docsClient.documents.batchUpdate({
      documentId: docsFileId,
      requestBody: { requests: requests }
    });
    
    console.log(`[${requestId}] ✅ Estilos aplicados`);
    
    // ============================================================
    // PASO 5: ESTILO BASE AL CUERPO DEL DOCUMENTO
    // ============================================================
    try {
      const updatedDoc = await docsClient.documents.get({
        documentId: docsFileId
      });
      
      const docEnd = updatedDoc.data.body.content[updatedDoc.data.body.content.length - 1].endIndex;
      const bodyStart = currentPos + 2; // Después del salto de página
      
      if (bodyStart < docEnd - 1) {
        await docsClient.documents.batchUpdate({
          documentId: docsFileId,
          requestBody: {
            requests: [
              {
                updateTextStyle: {
                  range: { startIndex: bodyStart, endIndex: docEnd - 1 },
                  textStyle: {
                    weightedFontFamily: { fontFamily: TYPO.body.family, weight: TYPO.body.weight },
                    fontSize: { magnitude: TYPO.body.size, unit: 'PT' },
                    foregroundColor: { color: { rgbColor: COLORS.bodyGray } }
                  },
                  fields: 'weightedFontFamily,fontSize,foregroundColor'
                }
              },
              {
                updateParagraphStyle: {
                  range: { startIndex: bodyStart, endIndex: docEnd - 1 },
                  paragraphStyle: {
                    lineSpacing: 125,
                    spaceBelow: { magnitude: 8, unit: 'PT' },
                    alignment: 'JUSTIFIED'
                  },
                  fields: 'lineSpacing,spaceBelow,alignment'
                }
              }
            ]
          }
        });
        
        console.log(`[${requestId}] ✅ Estilo base aplicado al cuerpo`);
      }
    } catch (bodyError) {
      console.warn(`[${requestId}] ⚠️ Estilo cuerpo no aplicado:`, bodyError.message);
      result.warnings.push(`Estilo cuerpo: ${bodyError.message}`);
    }
    
    // ============================================================
    // PASO 6: EXPORTAR A PDF
    // ============================================================
    try {
      console.log(`[${requestId}] 📄 Exportando a PDF...`);
      
      const pdfExport = await drive.files.export({
        fileId: docsFileId,
        mimeType: 'application/pdf'
      }, { responseType: 'arraybuffer' });
      
      const pdfStream = Readable.from(Buffer.from(pdfExport.data));
      
      const pdfUpload = await drive.files.create({
        requestBody: {
          name: `FORMATTED_${submissionId}.pdf`,
          mimeType: 'application/pdf',
          parents: editorialFolderId ? [editorialFolderId] : undefined
        },
        media: {
          mimeType: 'application/pdf',
          body: pdfStream
        },
        fields: 'id, webViewLink'
      });
      
      result.pdfFileId = pdfUpload.data.id;
      result.pdfFileUrl = pdfUpload.data.webViewLink;
      
      console.log(`[${requestId}] ✅ PDF creado: ${result.pdfFileId}`);
      
    } catch (pdfError) {
      console.warn(`[${requestId}] ⚠️ Error creando PDF:`, pdfError.message);
      result.warnings.push(`PDF: ${pdfError.message}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fatal:`, error.message);
    result.success = false;
    result.errors.push(error.message);
    return result;
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
    keywords, keywordsEn, area, paperLanguage = 'es',
    
    // NUEVO: Metadatos del vocabulario controlado
    keywordsVocabulario,        // "JEL" | "MeSH" | "ACM" | "UNESCO"
    keywordsRaw = [],           // [{code: "B14", term: "Marxism"}, ...]
    keywordsRawEn = [],         // Versión en inglés
    
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
        authorEmail, authorName,
        
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
        
        // NUEVO: Declaraciones aceptadas (para auditoría)
        declarations
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
// 🔄 CAMBIO: Función normalizadora de keywords (soporte dual legacy/controlled)
const normalizeKeywords = (keywordsInput, keywordsRawInput, vocabularioInput) => {
    // CASO 1: Vienen keywordsRaw estructuradas (formulario nuevo)
    if (keywordsRawInput && Array.isArray(keywordsRawInput) && keywordsRawInput.length > 0) {
        const valid = keywordsRawInput.filter(k => k.code?.trim() && k.term?.trim());
        if (valid.length > 0) {
            return {
                keywords: valid.map(k => `${k.code}: ${k.term}`),
                keywordsRaw: valid.map(k => ({
                    code: sanitizeText(k.code),
                    term: sanitizeText(k.term)
                })),
                keywordsVocabulario: vocabularioInput || 'unknown',
                keywordsFormat: 'controlled'
            };
        }
    }

    // CASO 2: Vienen como string serializado (formulario antiguo o mixto)
    if (keywordsInput && typeof keywordsInput === 'string' && keywordsInput.trim()) {
        const parts = keywordsInput.split(';').map(k => sanitizeText(k.trim())).filter(Boolean);
        
        // Detectar si tiene formato controlado (CÓDIGO: Término)
        const looksControlled = parts.length > 0 && parts.every(p => /^[A-Za-z0-9.]+:/.test(p));
        
        if (looksControlled) {
            const raw = parts.map(p => {
                const colonIndex = p.indexOf(':');
                return {
                    code: sanitizeText(p.substring(0, colonIndex).trim()),
                    term: sanitizeText(p.substring(colonIndex + 1).trim())
                };
            });
            return {
                keywords: parts,
                keywordsRaw: raw,
                keywordsVocabulario: vocabularioInput || 'unknown',
                keywordsFormat: 'controlled'
            };
        }
        
        // Formato legacy (strings simples)
        return {
            keywords: parts,
            keywordsRaw: parts.map(k => ({ code: '', term: k })),
            keywordsVocabulario: 'legacy',
            keywordsFormat: 'legacy'
        };
    }

    // CASO 3: Ya es un array (viene de Firestore)
    if (Array.isArray(keywordsInput) && keywordsInput.length > 0) {
        const parts = keywordsInput.map(k => typeof k === 'string' ? sanitizeText(k.trim()) : String(k));
        const looksControlled = parts.every(p => /^[A-Za-z0-9.]+:/.test(p));
        
        if (looksControlled) {
            const raw = parts.map(p => {
                const colonIndex = p.indexOf(':');
                return {
                    code: sanitizeText(p.substring(0, colonIndex).trim()),
                    term: sanitizeText(p.substring(colonIndex + 1).trim())
                };
            });
            return {
                keywords: parts,
                keywordsRaw: raw,
                keywordsVocabulario: vocabularioInput || 'unknown',
                keywordsFormat: 'controlled'
            };
        }
        
        return {
            keywords: parts,
            keywordsRaw: parts.map(k => ({ code: '', term: typeof k === 'string' ? k : String(k) })),
            keywordsVocabulario: 'legacy',
            keywordsFormat: 'legacy'
        };
    }

    // CASO 4: Vacío
    return {
        keywords: [],
        keywordsRaw: [],
        keywordsVocabulario: 'legacy',
        keywordsFormat: 'legacy'
    };
};

// 🔄 CAMBIO: Aplicar normalización
const normalizedKeywordsES = normalizeKeywords(keywords, keywordsRaw, keywordsVocabulario);
const normalizedKeywordsEN = normalizeKeywords(keywordsEn, keywordsRawEn, keywordsVocabulario);

// 🔄 CAMBIO: Validación de keywords normalizada (mínimo 2, máximo 6)
const totalKeywords = normalizedKeywordsES.keywords.length;
if (totalKeywords < 2) {
    return res.status(400).json({
        error: 'Debes incluir al menos 2 palabras clave',
        missingFields: ['keywords']
    });
}
if (totalKeywords > 6) {
    return res.status(400).json({
        error: 'Máximo 6 palabras clave permitidas',
        missingFields: ['keywords']
    });
}

if (keywordsRaw.length > 6) {
    return res.status(400).json({
        error: 'Máximo 6 palabras clave permitidas',
        missingFields: ['keywordsRaw']
    });
}

// Validar que cada keyword tenga code y term
const invalidKeywords = keywordsRaw.filter(k => !k.code?.trim() || !k.term?.trim());
if (invalidKeywords.length > 0) {
    return res.status(400).json({
        error: 'Cada palabra clave debe tener un código y un término',
        missingFields: ['keywordsRaw']
    });
}
      const requiredFields = { title, abstract, area, manuscriptBase64, authors, articleType };
      // Y agregar validación específica para keywordsRaw:
if (!keywordsRaw || !Array.isArray(keywordsRaw) || keywordsRaw.length < 2) {
  return res.status(400).json({
    error: 'Faltan campos requeridos',
    missingFields: ['keywords']
  });
}
      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value)
        .map(([key]) => key);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ error: 'Faltan campos requeridos', missingFields });
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
      if (Array.isArray(minorAuthors)) {
        for (const minor of minorAuthors) {
          if (minor.consentMethod === 'upload' && minor.consentFile?.data) {
            try {
              const consentFileName = `CONSENT_${minor.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
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
        authorEmail: authorEmailToUse,
        authorName: authorName || `${processedAuthors[0].firstName} ${processedAuthors[0].lastName}`.trim(),
        
        // Datos del artículo
        title: sanitizeText(title),
        titleEn: titleEn ? sanitizeText(titleEn) : null,
        abstract: sanitizeText(abstract),
        abstractEn: abstractEn ? sanitizeText(abstractEn) : null,
        // NUEVO: Procesar palabras clave controladas
// 🔄 CAMBIO: Keywords normalizadas (soporte dual)
keywords: normalizedKeywordsES.keywords,
keywordsEn: normalizedKeywordsEN.keywords.length > 0 ? normalizedKeywordsEN.keywords : normalizedKeywordsES.keywords,
keywordsVocabulario: normalizedKeywordsES.keywordsVocabulario,
keywordsRaw: normalizedKeywordsES.keywordsRaw,
keywordsRawEn: normalizedKeywordsEN.keywordsRaw.length > 0 ? normalizedKeywordsEN.keywordsRaw : normalizedKeywordsES.keywordsRaw,
keywordsFormat: normalizedKeywordsES.keywordsFormat,
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
        
        // Estado y metadata
        status: 'submitted',
        currentRound: 1,
        
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        
        userAgent: req.headers['user-agent'] || null,
        ipAddress: clientIp,
        requestId
      };

// PROCESAR DOCUMENTO CON GOOGLE DOCS API
// PROCESAR DOCUMENTO CON GOOGLE DOCS API
let formattedDocsFile = null;
let formattedPdfFile = null;

try {
  console.log(`[${requestId}] 🎨 Iniciando formateo del documento...`);
  
  // ✅ NUEVO: Verificar que google esté disponible antes de formatear
  if (!google) {
    console.log(`[${requestId}] ⏳ google no disponible para formateo, intentando cargar...`);
    await loadDependencies();
  }
  
  // Si después de cargar sigue sin estar disponible, saltamos el formateo
  if (!google) {
    console.warn(`[${requestId}] ⚠️ Google APIs no disponibles para formateo, continuando sin formatear`);
    throw new Error('Google APIs no disponibles');
  }
  
  const formattingResult = await processDocumentWithDocsAPI(
    drive, 
    docs,
    file.id, 
    submissionData, 
    requestId
  );
  
  formattedDocsFile = {
    id: formattingResult.docsFileId,
    url: formattingResult.docsFileUrl
  };
  
  formattedPdfFile = formattingResult.pdfFileUrl ? {
    id: formattingResult.pdfFileId,
    url: formattingResult.pdfFileUrl
  } : null;
  
  console.log(`[${requestId}] ✅ Documento formateado exitosamente`);
} catch (formatError) {
  console.error(`[${requestId}] ⚠️ Error en formateo (no crítico):`, formatError.message);
  // No es crítico, continuamos con el flujo normal
}

// Agregar al submissionData los archivos formateados
submissionData.formattedDocsFile = formattedDocsFile;
submissionData.formattedPdfFile = formattedPdfFile;
submissionData.documentStatus = formattedDocsFile ? 'processed' : 'submitted';

// Agregar al submissionData los archivos formateados
submissionData.formattedDocsFile = formattedDocsFile;
submissionData.formattedPdfFile = formattedPdfFile;
submissionData.documentStatus = 'processed'; // o 'processing' si falló


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
          byEmail: decodedToken.email,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          details: {
            articleType,
            area,
            paperLanguage,
            hasFunding: funding?.hasFunding || false,
            aiUsed: Boolean(aiUsed),
            requiresEthicsApproval: Boolean(requiresEthicsApproval),
            hasMinorAuthors: processedAuthors.some(a => a.isMinor),
            dataAvailability,
            codeAvailability: codeAvailability || null,
            keywordsVocabulario: normalizedKeywordsES.keywordsVocabulario,
keywordsCount: normalizedKeywordsES.keywords.length,
keywordsFormat: normalizedKeywordsES.keywordsFormat,
          }
        });
        
        // Actualizar contador del usuario
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
// NUEVO: Información de palabras clave
// 🔄 CAMBIO: Keywords info para correos (usa datos normalizados)
const keywordsInfo = normalizedKeywordsES.keywords.length > 0
    ? `<p><strong>🏷️ Palabras clave (${normalizedKeywordsES.keywordsVocabulario || 'Vocabulario'}):</strong><br>
        ${normalizedKeywordsES.keywordsRaw.map(k => 
            k.code 
                ? `<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;">${sanitizeText(k.code)}</code> ${sanitizeText(k.term)}`
                : sanitizeText(k.term)
        ).join('<br>')}
      </p>`
    : '';
        // NUEVO: Información de IA
        const aiInfo = aiUsed && processedAITools.length > 0
          ? `<p style="color: #0A1929;"><strong>🤖 IA utilizada:</strong> ${processedAITools.map(t => `${t.name} (${t.purpose})`).join(', ')}</p>`
          : '';

        // NUEVO: Disponibilidad de datos
        const availabilityInfo = `
          <p><strong>📊 Disponibilidad de datos:</strong> ${dataAvailability}</p>
          ${codeAvailability ? `<p><strong>💻 Disponibilidad de código:</strong> ${codeAvailability}</p>` : ''}
        `;

        const articleInfo = `
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            ${minorInfo}
            <p><strong>ID:</strong> ${submissionId}</p>
            <p><strong>Autor de envío:</strong> ${sanitizeText(authorName || 'No especificado')}</p>
            <p><strong>Email:</strong> ${authorEmailToUse}</p>
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

        emailPromises.push(
          sendEmailViaExtension(
            editor.email,
            `📄 Nuevo artículo: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`,
            htmlBody
          ).catch(err => console.log(`⚠️ Error email to ${editor.email}:`, err.message))
        );
      }

      // Correo al autor
      const authorEmailTitle = paperLanguage === 'es' 
        ? '✅ Confirmación de envío'
        : '✅ Submission confirmation';

      const authorGreeting = paperLanguage === 'es'
        ? `Estimado/a ${authorName || processedAuthors[0].firstName}:`
        : `Dear ${authorName || processedAuthors[0].firstName}:`;

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
// NUEVO: Información de palabras clave
// 🔄 CAMBIO: Keywords info para correos (usa datos normalizados)
const keywordsInfo = normalizedKeywordsES.keywords.length > 0
    ? `<p><strong>🏷️ Palabras clave (${normalizedKeywordsES.keywordsVocabulario || 'Vocabulario'}):</strong><br>
        ${normalizedKeywordsES.keywordsRaw.map(k => 
            k.code 
                ? `<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;">${sanitizeText(k.code)}</code> ${sanitizeText(k.term)}`
                : sanitizeText(k.term)
        ).join('<br>')}
      </p>`
    : '';
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
        correspondingAuthor: {
          name: `${correspondingAuthorData.firstName} ${correspondingAuthorData.lastName}`,
          email: correspondingAuthorData.email
        },
        message: paperLanguage === 'es' 
          ? 'Artículo enviado correctamente. Revisa tu correo para más detalles.'
          : 'Article submitted successfully. Check your email for more details.',
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
// ===================== VERSIÓN CORREGIDA de onEditorialReviewUpdated =====================
// ===================== VERSIÓN CORREGIDA de onEditorialReviewUpdated =====================
// REEMPLAZA la función existente con esta.
exports.onEditorialReviewUpdated = onDocumentUpdated(
  {
    document: 'editorialReviews/{reviewId}',
    secrets: [], // Usa la extensión de email
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

      // --- LÓGICA CORREGIDA: SOLO CAMBIA ESTADOS, NO CREA TAREAS ---
      switch (afterData.decision) {
        case 'reject':
          newSubmissionStatus = 'rejected';
          newTaskStatus = 'completed'; // La tarea del editor termina aquí
          emailHtml = getRejectionEmailBody(afterData.feedbackToAuthor, submissionData.title, lang, authorName);
          break;
          
        case 'minor-revision':
        case 'major-revision':
          // ¡CORRECCIÓN! El editor pide cambios. El artículo y la tarea pasan a esperar al autor.
          newSubmissionStatus = 'revisions-requested';
          newTaskStatus = 'awaiting-author-revision'; // La tarea espera la acción del autor
          emailHtml = getRevisionEmailBody(afterData.feedbackToAuthor, submissionData.title, afterData.decision === 'minor-revision' ? 'minor' : 'major', lang, authorName);
          break;
          
        case 'revision-required': // Este es el caso para INICIAR REVISIÓN POR PARES
          console.log(`🎯 Decisión 'revision-required' tomada. Iniciando selección de revisores.`);
          newSubmissionStatus = 'in-reviewer-selection'; // Estado del artículo
          newTaskStatus = 'reviewer-selection'; // <<<--- ¡¡ESTADO CORRECTO DE LA TAREA!!
          // El email al autor es de "inicio de revisión por pares"
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
          status: newTaskStatus, // <<<--- AHORA SÍ SE ACTUALIZA EL ESTADO
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await taskRef.update(updateData);
        console.log(`✅ Tarea editorial ${afterData.editorialTaskId} actualizada a estado: ${newTaskStatus}`);
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
// ===================== MEJORA: TRIGGER PARA CUANDO SE COMPLETA UNA REVISIÓN =====================
// ===================== TRIGGER: CUANDO SE COMPLETA UNA REVISIÓN (CORREGIDO) =====================
exports.onReviewerAssignmentSubmitted = onDocumentUpdated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN], // ← CORREGIDO
    memory: '512MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const assignmentId = event.params.invitationId;

    if (beforeData.status === afterData.status || afterData.status !== 'submitted') {
      return;
    }

    console.log(`📝 [REVIEW COMPLETED] Nueva revisión: ${assignmentId} - ${afterData.reviewerEmail}`);

    // Declarar db al inicio para que esté disponible en todo el scope
    const db = admin.firestore();
    const warnings = [];

    try {
      const taskId = afterData.editorialTaskId;
      
      if (!taskId) {
        console.warn('⚠️ Sin editorialTaskId. Abortando.');
        return;
      }

      // ===== PASO 1: Obtener datos de la tarea y submission =====
      const taskRef = db.collection('editorialTasks').doc(taskId);
      const taskSnap = await taskRef.get();
      if (!taskSnap.exists) {
        console.error(`❌ Tarea no encontrada: ${taskId}`);
        return;
      }
      const taskData = taskSnap.data();

      const submissionRef = db.collection('submissions').doc(taskData.submissionId);
      const submissionSnap = await submissionRef.get();
      if (!submissionSnap.exists) {
        console.error(`❌ Submission no encontrado: ${taskData.submissionId}`);
        return;
      }
      const submissionData = submissionSnap.data();

      // ===== PASO 2: Contar revisiones completadas =====
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .where('status', '==', 'submitted')
        .get();

      const submittedCount = assignmentsSnapshot.size;
      const requiredReviews = taskData.requiredReviews || 2;
      
      console.log(`📊 Revisiones: ${submittedCount}/${requiredReviews}`);

      // Registrar revisión recibida
      try {
        await db.collection('submissions').doc(taskData.submissionId)
          .collection('auditLogs').add({
            action: 'review_submitted',
            details: `Revisión de ${afterData.reviewerName || afterData.reviewerEmail}`,
            reviewerId: assignmentId,
            recommendation: afterData.recommendation,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
      } catch (auditError) {
        console.warn(`⚠️ Error en audit log:`, auditError.message);
      }

      // ===== PASO 3: SI SE ALCANZA EL MÍNIMO, PROCESAR COMENTARIOS =====
      if (submittedCount >= requiredReviews) {
        console.log(`🎯 MÍNIMO ALCANZADO (${submittedCount}/${requiredReviews}). Procesando comentarios...`);

        // Inicializar Google Drive (con manejo de errores)
        let drive;
        try {
          const driveClients = await getDriveClient(`extract-comments-${taskId}`);
          drive = driveClients.drive;
          
          if (!drive?.files?.copy) {
            throw new Error('Cliente de Google Drive mal inicializado');
          }
        } catch (driveError) {
          console.error(`❌ Error inicializando Drive:`, driveError.message);
          warnings.push('drive_init_failed');
          // Continuar sin Drive - actualizar estados igual
          await updateTaskStatusSafely(db, taskRef, submissionRef, submittedCount, null, null);
          return;
        }

        // ===== PASO 4: EXTRAER COMENTARIOS DE TODOS LOS REVISORES =====
        const allReviewerComments = [];
        
        for (const doc of assignmentsSnapshot.docs) {
          const reviewData = doc.data();
          const reviewerFileId = reviewData.reviewerFileId;
          
          if (!reviewerFileId) {
            console.warn(`⚠️ Revisor ${reviewData.reviewerEmail} sin reviewerFileId. Omitiendo comentarios.`);
            warnings.push(`no_file_${reviewData.reviewerEmail}`);
            continue;
          }

          console.log(`📄 Extrayendo comentarios de: ${reviewerFileId}`);
          
          try {
            const comments = await extractCommentsFromDocument(drive, reviewerFileId);
            
            allReviewerComments.push({
              reviewerNumber: allReviewerComments.length + 1,
              reviewerEmail: reviewData.reviewerEmail,
              reviewerName: reviewData.reviewerName || 'Revisor',
              recommendation: reviewData.recommendation || 'No especificada',
              commentsToAuthor: reviewData.commentsToAuthor || '',
              commentsToEditor: reviewData.commentsToEditor || '',
              documentComments: comments,
              submittedAt: reviewData.submittedAt
            });

            console.log(`✅ ${comments.length} comentarios extraídos del revisor ${allReviewerComments.length}`);

          } catch (commentError) {
            console.error(`❌ Error extrayendo comentarios de ${reviewerFileId}:`, commentError.message);
            warnings.push(`extract_failed_${reviewData.reviewerEmail}`);
            // Continuar con el siguiente revisor aunque falle uno
          }
        }

        // ===== PASO 5: CREAR DOCUMENTO FINAL CON REVISIONES =====
        let finalDocId = null;
        let finalDocUrl = null;

        try {
          const sourceFileId = submissionData.formattedDocsFile?.id || submissionData.originalFileId;

          if (!sourceFileId) {
            throw new Error('No se encontró documento fuente');
          }

          console.log(`📝 Creando documento final con ${allReviewerComments.length} revisiones...`);

          // Crear copia del documento original
          const finalCopy = await drive.files.copy({
            fileId: sourceFileId,
            requestBody: {
              name: `FINAL_WITH_REVIEWS_${submissionData.submissionId}`,
              parents: [submissionData.editorialFolderId],
              mimeType: 'application/vnd.google-apps.document'
            },
            fields: 'id, webViewLink'
          });

          finalDocId = finalCopy.data.id;
          finalDocUrl = finalCopy.data.webViewLink;
          
          console.log(`✅ Documento final creado: ${finalDocId}`);

          // Otorgar permisos al editor (no bloqueante)
          try {
            await configureEditorPermissions(drive, finalDocId, taskData, assignmentsSnapshot);
          } catch (permError) {
            console.warn(`⚠️ Error configurando permisos:`, permError.message);
            warnings.push('permissions_error');
          }

          // Insertar la sección de revisiones (no bloqueante)
          try {
            await insertReviewsSection(drive, finalDocId, allReviewerComments, submissionData);
            console.log(`✅ Sección de revisiones insertada`);
          } catch (insertError) {
            console.error(`❌ Error insertando revisiones:`, insertError.message);
            warnings.push('insert_reviews_failed');
          }

        } catch (docError) {
          console.error(`❌ Error creando documento final:`, docError.message);
          warnings.push('final_doc_failed');
        }

        // ===== PASO 6: PROGRAMAR ELIMINACIÓN DE DOCUMENTOS DE REVISORES =====
        try {
          console.log(`⏰ Programando eliminación de documentos temporales...`);
          
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
                reason: 'Documentos de revisión individual ya consolidados'
              });
            }
          }
        } catch (deleteSchedError) {
          console.warn(`⚠️ Error programando eliminaciones:`, deleteSchedError.message);
        }

        // ===== PASO 7: GUARDAR REFERENCIA AL DOCUMENTO FINAL =====
        if (finalDocId) {
          try {
            await submissionRef.update({
              finalReviewDocId: finalDocId,
              finalReviewDocUrl: finalDocUrl,
              reviewsConsolidatedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Guardar comentarios extraídos como respaldo
            await db.collection('submissions').doc(taskData.submissionId)
              .collection('extractedReviews').add({
                reviewerComments: allReviewerComments,
                extractedAt: admin.firestore.FieldValue.serverTimestamp(),
                finalDocId: finalDocId,
                finalDocUrl: finalDocUrl
              });
          } catch (updateError) {
            console.error(`❌ Error guardando referencia:`, updateError.message);
          }
        }

        // ===== PASO 8: ACTUALIZAR ESTADOS =====
        await updateTaskStatusSafely(db, taskRef, submissionRef, submittedCount, finalDocId, finalDocUrl);

        // ===== PASO 9: ENVIAR EMAIL AL EDITOR (NO BLOQUEANTE) =====
        try {
          await sendEditorDecisionEmail(
            taskData, 
            submissionData, 
            assignmentsSnapshot, 
            submittedCount, 
            finalDocUrl
          );
        } catch (emailError) {
          console.warn(`⚠️ Error enviando email:`, emailError.message);
        }

        console.log(`✅ Proceso completado. FinalDoc: ${finalDocUrl || 'No disponible'}`);
        console.log(`⚠️ Warnings: ${warnings.length > 0 ? warnings.join(', ') : 'Ninguno'}`);

      } else {
        console.log(`⏳ Solo ${submittedCount}/${requiredReviews} revisiones. Esperando más.`);
      }

      return { success: true, warnings };

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentSubmitted:`, error.message);
      console.error(`❌ Stack:`, error.stack);
      
      // db está disponible aquí porque se declaró al inicio
      try {
        await db.collection('systemErrors').add({
          function: 'onReviewerAssignmentSubmitted',
          error: {
            message: error.message,
            stack: error.stack?.substring(0, 500) || 'No stack'
          },
          assignmentId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logError) {
        console.error(`❌ Error al registrar error:`, logError.message);
      }
      
      return { success: false, error: error.message };
    }
  }
);

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
// FUNCIÓN: EXTRAER COMENTARIOS DE UN DOCUMENTO
// ============================================================
async function extractCommentsFromDocument(drive, fileId) {
  try {
    const response = await drive.comments.list({
      fileId: fileId,
      fields: 'comments(id, content, anchor, author(displayName, emailAddress), createdTime, modifiedTime, resolved, replies(id, content, author(displayName), createdTime))',
      pageSize: 100
    });

    const comments = response.data.comments || [];
    
    // Formatear comentarios para el documento final
    const formattedComments = [];
    
    for (const comment of comments) {
      // Solo incluir comentarios no resueltos (los que el revisor dejó)
      if (!comment.resolved) {
        const commentData = {
          id: comment.id,
          content: comment.content,
          author: comment.author?.displayName || 'Anónimo',
          createdTime: comment.createdTime,
          resolved: comment.resolved || false,
          replies: []
        };

        // Incluir respuestas si existen
        if (comment.replies && comment.replies.length > 0) {
          commentData.replies = comment.replies.map(reply => ({
            id: reply.id,
            content: reply.content,
            author: reply.author?.displayName || 'Anónimo',
            createdTime: reply.createdTime
          }));
        }

        formattedComments.push(commentData);
      }
    }

    return formattedComments;

  } catch (error) {
    console.error(`❌ Error extrayendo comentarios de ${fileId}:`, error.message);
    return [];
  }
}

// ============================================================
// FUNCIÓN: INSERTAR SECCIÓN DE REVISIONES EN EL DOCUMENTO FINAL
// ============================================================
async function insertReviewsSection(drive, docsFileId, allReviewerComments, submissionData) {
  try {
    const { google } = require('googleapis');
    const docs = google.docs({ version: 'v1', auth: drive.auth });
    
    // Obtener el final del documento
    const document = await docs.documents.get({
      documentId: docsFileId
    });
    
    const docEnd = document.data.body.content[document.data.body.content.length - 1].endIndex - 1;
    
    const requests = [];
    
    // Insertar salto de página antes de la sección de revisiones
    requests.push({
      insertPageBreak: {
        location: { index: docEnd }
      }
    });
    
    let insertIndex = docEnd + 1;
    
    // ===== TÍTULO DE LA SECCIÓN =====
    const sectionTitle = '\nREVISIONES\n\n';
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: sectionTitle
      }
    });
    
    // Estilo del título
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: insertIndex, endIndex: insertIndex + sectionTitle.length },
        paragraphStyle: {
          namedStyleType: 'HEADING_1',
          alignment: 'CENTER',
          spaceBelow: { magnitude: 24, unit: 'PT' }
        },
        fields: 'namedStyleType,alignment,spaceBelow'
      }
    });
    
    insertIndex += sectionTitle.length;
    
    // ===== INSERTAR REVISIÓN DE CADA REVISOR =====
    for (const review of allReviewerComments) {
      // Línea separadora
      const separator = '─'.repeat(60) + '\n\n';
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: separator
        }
      });
      
      requests.push({
        updateTextStyle: {
          range: { startIndex: insertIndex, endIndex: insertIndex + separator.length },
          textStyle: {
            foregroundColor: { color: { rgbColor: { red: 0.0, green: 0.32, blue: 0.62 } } },
            fontSize: { magnitude: 8, unit: 'PT' }
          },
          fields: 'foregroundColor,fontSize'
        }
      });
      
      insertIndex += separator.length;
      
      // Encabezado del revisor
      const reviewerHeader = `Revisor ${review.reviewerNumber}\n`;
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: reviewerHeader
        }
      });
      
      requests.push({
        updateTextStyle: {
          range: { startIndex: insertIndex, endIndex: insertIndex + reviewerHeader.length },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 14, unit: 'PT' },
            foregroundColor: { color: { rgbColor: { red: 0.1, green: 0.1, blue: 0.1 } } }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
      
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: insertIndex, endIndex: insertIndex + reviewerHeader.length },
          paragraphStyle: {
            alignment: 'START',
            spaceBelow: { magnitude: 8, unit: 'PT' }
          },
          fields: 'alignment,spaceBelow'
        }
      });
      
      insertIndex += reviewerHeader.length;
      
      // Recomendación
      const recommendationText = `Recomendación: ${review.recommendation}\n`;
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: recommendationText
        }
      });
      
      requests.push({
        updateTextStyle: {
          range: { startIndex: insertIndex, endIndex: insertIndex + recommendationText.length },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 11, unit: 'PT' },
            foregroundColor: { color: { rgbColor: { red: 0.0, green: 0.32, blue: 0.62 } } }
          },
          fields: 'bold,fontSize,foregroundColor'
        }
      });
      
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: insertIndex, endIndex: insertIndex + recommendationText.length },
          paragraphStyle: {
            spaceBelow: { magnitude: 12, unit: 'PT' }
          },
          fields: 'spaceBelow'
        }
      });
      
      insertIndex += recommendationText.length;
      
      // Comentarios para el autor
      if (review.commentsToAuthor) {
        const authorCommentsLabel = 'Comentarios para el autor:\n';
        requests.push({
          insertText: {
            location: { index: insertIndex },
            text: authorCommentsLabel
          }
        });
        
        requests.push({
          updateTextStyle: {
            range: { startIndex: insertIndex, endIndex: insertIndex + authorCommentsLabel.length },
            textStyle: {
              bold: true,
              fontSize: { magnitude: 10, unit: 'PT' }
            },
            fields: 'bold,fontSize'
          }
        });
        
        insertIndex += authorCommentsLabel.length;
        
        const authorCommentsText = review.commentsToAuthor + '\n\n';
        requests.push({
          insertText: {
            location: { index: insertIndex },
            text: authorCommentsText
          }
        });
        
        requests.push({
          updateTextStyle: {
            range: { startIndex: insertIndex, endIndex: insertIndex + authorCommentsText.length },
            textStyle: {
              fontSize: { magnitude: 10, unit: 'PT' },
              foregroundColor: { color: { rgbColor: { red: 0.2, green: 0.2, blue: 0.2 } } }
            },
            fields: 'fontSize,foregroundColor'
          }
        });
        
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: insertIndex, endIndex: insertIndex + authorCommentsText.length },
            paragraphStyle: {
              spaceBelow: { magnitude: 12, unit: 'PT' }
            },
            fields: 'spaceBelow'
          }
        });
        
        insertIndex += authorCommentsText.length;
      }
      
      // Comentarios en el documento (extraídos)
      if (review.documentComments && review.documentComments.length > 0) {
        const docCommentsLabel = 'Comentarios en el documento:\n';
        requests.push({
          insertText: {
            location: { index: insertIndex },
            text: docCommentsLabel
          }
        });
        
        requests.push({
          updateTextStyle: {
            range: { startIndex: insertIndex, endIndex: insertIndex + docCommentsLabel.length },
            textStyle: {
              bold: true,
              fontSize: { magnitude: 10, unit: 'PT' }
            },
            fields: 'bold,fontSize'
          }
        });
        
        insertIndex += docCommentsLabel.length;
        
        // Formatear cada comentario
        for (let i = 0; i < review.documentComments.length; i++) {
          const comment = review.documentComments[i];
          const commentNumber = i + 1;
          
          // Texto del comentario
          let commentText = `${commentNumber}. ${comment.content}\n`;
          
          requests.push({
            insertText: {
              location: { index: insertIndex },
              text: commentText
            }
          });
          
          requests.push({
            updateTextStyle: {
              range: { startIndex: insertIndex, endIndex: insertIndex + commentText.length },
              textStyle: {
                fontSize: { magnitude: 10, unit: 'PT' },
                foregroundColor: { color: { rgbColor: { red: 0.15, green: 0.15, blue: 0.15 } } },
                italic: false
              },
              fields: 'fontSize,foregroundColor,italic'
            }
          });
          
          requests.push({
            updateParagraphStyle: {
              range: { startIndex: insertIndex, endIndex: insertIndex + commentText.length },
              paragraphStyle: {
                spaceBelow: { magnitude: 4, unit: 'PT' },
                indentStart: { magnitude: 20, unit: 'PT' }
              },
              fields: 'spaceBelow,indentStart'
            }
          });
          
          insertIndex += commentText.length;
          
          // Respuestas si existen
          if (comment.replies && comment.replies.length > 0) {
            for (const reply of comment.replies) {
              let replyText = `   ↳ Respuesta: ${reply.content}\n`;
              
              requests.push({
                insertText: {
                  location: { index: insertIndex },
                  text: replyText
                }
              });
              
              requests.push({
                updateTextStyle: {
                  range: { startIndex: insertIndex, endIndex: insertIndex + replyText.length },
                  textStyle: {
                    fontSize: { magnitude: 9, unit: 'PT' },
                    foregroundColor: { color: { rgbColor: { red: 0.4, green: 0.4, blue: 0.4 } } },
                    italic: true
                  },
                  fields: 'fontSize,foregroundColor,italic'
                }
              });
              
              requests.push({
                updateParagraphStyle: {
                  range: { startIndex: insertIndex, endIndex: insertIndex + replyText.length },
                  paragraphStyle: {
                    spaceBelow: { magnitude: 2, unit: 'PT' },
                    indentStart: { magnitude: 40, unit: 'PT' }
                  },
                  fields: 'spaceBelow,indentStart'
                }
              });
              
              insertIndex += replyText.length;
            }
          }
        }
        
        // Espacio después de los comentarios
        const spacer = '\n';
        requests.push({
          insertText: {
            location: { index: insertIndex },
            text: spacer
          }
        });
        insertIndex += spacer.length;
      }
    }
    
    // ===== LÍNEA FINAL =====
    const finalSeparator = '\n' + '─'.repeat(60) + '\n';
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: finalSeparator
      }
    });
    
    requests.push({
      updateTextStyle: {
        range: { startIndex: insertIndex, endIndex: insertIndex + finalSeparator.length },
        textStyle: {
          foregroundColor: { color: { rgbColor: { red: 0.0, green: 0.32, blue: 0.62 } } },
          fontSize: { magnitude: 8, unit: 'PT' }
        },
        fields: 'foregroundColor,fontSize'
      }
    });
    
    // ===== EJECUTAR TODOS LOS CAMBIOS EN LOTES =====
    console.log(`📝 Aplicando ${requests.length} cambios al documento final...`);
    
    for (let i = 0; i < requests.length; i += 50) {
      const batch = requests.slice(i, i + 50);
      await docs.documents.batchUpdate({
        documentId: docsFileId,
        requestBody: { requests: batch }
      });
      console.log(`✅ Lote ${Math.floor(i/50) + 1}/${Math.ceil(requests.length/50)} aplicado`);
    }
    
    console.log(`✅ Sección de revisiones insertada correctamente`);
    
  } catch (error) {
    console.error(`❌ Error insertando sección de revisiones:`, error.message);
    throw error;
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
      
      const { submissionId, fileBase64, fileName, notes, round } = req.body;
      
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
      
      const drive = await getDriveClient();
      
      const folderId = submission.editorialFolderId || submission.driveFolderId;
      
      if (!folderId) {
        return res.status(500).json({ error: 'No hay carpeta de Drive asociada' });
      }
      
      const revisionFileName = `REVISION_R${round + 1}_${Date.now()}_${fileName}`;
      
      const file = await uploadToDrive(drive, fileBase64, revisionFileName, folderId);
      
      const versionRef = db.collection('submissions').doc(submissionId).collection('versions');
      await versionRef.add({
        version: round + 1,
        fileId: file.id,
        fileUrl: file.webViewLink,
        fileName: revisionFileName,
        fileSize: file.size,
        notes: notes || '',
        type: 'revision',
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        uploadedBy: uid,
        uploadedByEmail: decodedToken.email
      });
      
      await submissionRef.update({
        status: 'in-desk-review',
        lastRevisionAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const auditLogRef = db.collection('submissions').doc(submissionId).collection('auditLogs');
      await auditLogRef.add({
        action: 'revision_submitted',
        round: round + 1,
        notes: notes,
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
// ===================== AUTO CREATE NEXT ROUND ON REVISION - VERSIÓN CON NUEVA TAREA =====================
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
      const newRound = (submissionData.currentRound || 1) + 1;

      console.log(`🎯 Procesando revisión para ronda ${newRound} de ${submissionId}`);

      // ===== 1. BUSCAR LA TAREA PENDIENTE EN ESPERA DEL AUTOR (ronda anterior) =====
      const pendingTaskSnapshot = await db.collection('editorialTasks')
        .where('submissionId', '==', submissionId)
        .where('status', '==', 'awaiting-author-revision')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      let oldTaskId = null;
      let assignedTo, assignedToEmail, assignedToName;

      if (pendingTaskSnapshot.empty) {
        // No debería pasar, pero por si acaso, intentamos obtener la última tarea de cualquier estado
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

      // ===== 2. MARCAR LA TAREA ANTERIOR COMO COMPLETADA (si existe) =====
      if (oldTaskId) {
        await db.collection('editorialTasks').doc(oldTaskId).update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          nextTaskId: null, // Se actualizará después con el ID de la nueva tarea
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Tarea anterior ${oldTaskId} marcada como completada.`);
      }

      // ===== 3. CREAR NUEVA TAREA EDITORIAL PARA LA NUEVA RONDA =====
      const newTaskData = {
        submissionId: submissionId,
        submissionTitle: submissionData.title || 'Sin título',
        round: newRound,
        status: 'desk-review-in-progress', // La ponemos directamente en este estado para que el editor vea la pestaña de desk review
        assignedTo: assignedTo,
        assignedToEmail: assignedToEmail,
        assignedToName: assignedToName,
        assignedBy: assignedTo, // Asumimos que el mismo editor se asigna a sí mismo (o podría ser el sistema)
        assignmentNotes: `Nueva ronda generada automáticamente tras recibir revisión del autor.`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Inicializar contadores
        acceptedReviewers: 0,
        reviewsSubmitted: 0,
        reviewerIds: []
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

      // ===== 4. CREAR NUEVA REVISIÓN EDITORIAL VINCULADA A LA NUEVA TAREA =====
      const editorialReviewData = {
        submissionId: submissionId,
        round: newRound,
        status: 'pending', // La revisión editorial empieza pendiente (aunque la tarea esté en desk-review-in-progress)
        editorUid: assignedTo,
        editorEmail: assignedToEmail,
        editorName: assignedToName,
        editorialTaskId: newTaskId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const editorialReviewRef = await db.collection('editorialReviews').add(editorialReviewData);
      console.log(`✅ Nueva revisión editorial creada: ${editorialReviewRef.id} para tarea ${newTaskId}`);

      // ===== 5. ACTUALIZAR LA NUEVA TAREA CON EL ID DE LA REVIEW =====
      await newTaskRef.update({
        editorialReviewId: editorialReviewRef.id,
        currentReviewId: editorialReviewRef.id
      });

      // ===== 6. ACTUALIZAR EL SUBMISSION CON LAS NUEVAS REFERENCIAS =====
      await submissionRef.update({
  currentRound: newRound,
  status: 'in-editorial-review',
  currentEditorialTaskId: newTaskId,
  currentEditorialReviewId: editorialReviewRef.id,
  lastRevisionAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  // Resetear campos de decisión (opcional pero recomendado)
  deskReviewDecision: null,
  deskReviewFeedback: '',
  deskReviewCompletedAt: null,
  finalDecision: null,
  finalFeedback: '',
  decisionMadeAt: null,
  decisionMadeBy: null
});
      // ===== 7. REGISTRAR EN AUDIT LOG =====
      await db.collection('submissions').doc(submissionId)
        .collection('auditLogs').add({
          action: 'new_round_created_with_new_task',
          round: newRound,
          details: `Ronda ${newRound} creada con nueva tarea ${newTaskId} y revisión ${editorialReviewRef.id}`,
          oldTaskId: oldTaskId,
          newTaskId: newTaskId,
          editorialReviewId: editorialReviewRef.id,
          versionId: versionId,
          assignedTo: assignedToEmail,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      // ===== 8. ENVIAR NOTIFICACIÓN AL EDITOR =====
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
// ===================== NOTIFICAR DIRECTOR CUANDO ARTÍCULO ESTÉ LISTO =====================
exports.onArticleReadyForPublication = onDocumentUpdated(
  {
    document: 'submissions/{submissionId}',
    secrets: [], // Usa la extensión de email
    memory: '256MiB'
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

    try {
      const db = admin.firestore();

      // 1. Obtener los emails de los Directores Generales
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

      if (directorEmails.length === 0) {
        console.warn('⚠️ No se encontraron Directores Generales en la base de datos.');
        // Fallback a un email de contacto
        directorEmails.push({ email: 'contact@revistacienciasestudiantes.com', name: 'Director General' });
      }

      // 2. Obtener datos del artículo
      const submission = afterData;
      const lang = submission.paperLanguage || 'es';
      const isSpanish = lang === 'es';

      // 3. Construir el email
      const emailTitle = isSpanish
        ? `✅ Artículo listo para publicación: "${submission.title.substring(0, 60)}..."`
        : `✅ Article ready for publication: "${submission.title.substring(0, 60)}..."`;

      // Información de los metadatos finales
      const finalMetadata = submission.currentMetadata || submission.originalSubmission || {};
      
      // Crear una lista de metadatos
      const metadataList = `
        <ul style="margin-top: 10px;">
          <li><strong>Título:</strong> ${finalMetadata.title || 'N/A'}</li>
          ${finalMetadata.titleEn ? `<li><strong>Title (EN):</strong> ${finalMetadata.titleEn}</li>` : ''}
          <li><strong>Autores:</strong> ${finalMetadata.authors?.map(a => `${a.firstName} ${a.lastName}`).join('; ') || 'N/A'}</li>
          <li><strong>Área:</strong> ${finalMetadata.area || 'N/A'}</li>
          <li><strong>Palabras clave:</strong> ${finalMetadata.keywords?.join('; ') || 'N/A'}</li>
        </ul>
      `;

      const bodyContent = isSpanish
        ? `
          <p>El artículo <strong>"${submission.title}"</strong> ha sido marcado como <strong>listo para publicación</strong> por el equipo editorial.</p>
          
          <div class="highlight-box">
            <p class="article-title">"${submission.title}"</p>
            <p><strong>ID del envío:</strong> ${submission.submissionId}</p>
            <p><strong>Autor/a:</strong> ${submission.authorName || 'N/A'} (${submission.authorEmail || 'N/A'})</p>
            <p><strong>Marcado por:</strong> ${afterData.publicationReadyBy || 'Sistema'}</p>
            <p><strong>Fecha:</strong> ${afterData.publicationReadyAt?.toDate?.()?.toLocaleString('es-CL') || 'Fecha no disponible'}</p>
          </div>
          
          <h3>📄 Metadatos finales:</h3>
          ${metadataList}
          
          <h3>🔍 Acciones requeridas:</h3>
          <ol>
            <li>Revisar los metadatos finales del artículo.</li>
            <li>Verificar que todos los documentos (manuscrito, figuras, etc.) estén en orden.</li>
            <li>Proceder con la maquetación y asignación de DOI (si corresponde).</li>
            <li>Programar la publicación en el próximo número/volumen.</li>
          </ol>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/director/dashboard" class="btn">IR AL PANEL</a>
            <a href="${submission.driveFolderUrl || '#'}" class="btn btn-secondary">VER CARPETA EN DRIVE</a>
          </div>
        `
        : `
          <p>The article <strong>"${submission.title}"</strong> has been marked as <strong>ready for publication</strong> by the editorial team.</p>
          
          <div class="highlight-box">
            <p class="article-title">"${submission.title}"</p>
            <p><strong>Submission ID:</strong> ${submission.submissionId}</p>
            <p><strong>Author:</strong> ${submission.authorName || 'N/A'} (${submission.authorEmail || 'N/A'})</p>
            <p><strong>Marked by:</strong> ${afterData.publicationReadyBy || 'System'}</p>
            <p><strong>Date:</strong> ${afterData.publicationReadyAt?.toDate?.()?.toLocaleString('en-US') || 'Date not available'}</p>
          </div>
          
          <h3>📄 Final metadata:</h3>
          ${metadataList}
          
          <h3>🔍 Required actions:</h3>
          <ol>
            <li>Review the final article metadata.</li>
            <li>Verify that all documents (manuscript, figures, etc.) are in order.</li>
            <li>Proceed with layout and DOI assignment (if applicable).</li>
            <li>Schedule publication in the next issue/volume.</li>
          </ol>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/director/dashboard" class="btn">GO TO DASHBOARD</a>
            <a href="${submission.driveFolderUrl || '#'}" class="btn btn-secondary">VIEW DRIVE FOLDER</a>
          </div>
        `;

      const htmlBody = getEmailTemplate(
        emailTitle,
        isSpanish ? 'Estimado/a Director General:' : 'Dear General Director:',
        bodyContent,
        isSpanish ? 'Sistema Editorial' : 'Editorial System',
        isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students',
        isSpanish ? 'es' : 'en'
      );

      // 4. Enviar email a cada Director General
      const emailPromises = directorEmails.map(director => {
        const personalizedBody = htmlBody.replace(
          isSpanish ? 'Estimado/a Director General:' : 'Dear General Director:',
          isSpanish ? `Estimado/a ${director.name}:` : `Dear ${director.name}:`
        );
        
        return sendEmailViaExtension(
          director.email,
          emailTitle,
          personalizedBody
        ).catch(err => {
          console.error(`⚠️ Error enviando email a ${director.email}:`, err.message);
        });
      });

      await Promise.allSettled(emailPromises);
      console.log(`✅ Notificaciones enviadas a ${directorEmails.length} Directores Generales.`);

      // 5. Registrar en audit log
      await db.collection('submissions').doc(submissionId)
        .collection('auditLogs').add({
          action: 'director_notified_publication_ready',
          notifiedEmails: directorEmails.map(d => d.email),
          by: 'system',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
      console.error(`❌ Error en onArticleReadyForPublication:`, error.message);
      await logSystemError('onArticleReadyForPublication', error, { submissionId });
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
