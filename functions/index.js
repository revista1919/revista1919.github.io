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

/* ===================== UPLOAD NEWS (ACTUALIZADO CON DEEPSEEK) ===================== */
exports.uploadNews = onRequest(
  { 
    secrets: [GEMINI_API_KEY, DEEPSEEK_API_KEY], // Añadido DEEPSEEK_API_KEY
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

      // Verificar que las dependencias estén cargadas
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

      console.log("📝 Iniciando traducción con DeepSeek (fallback Gemini)");
      
      // Usar la función con fallback para el título
      const titleTarget = await translateText(titleSource, source, target);
      
      // Usar la función con fallback para el body
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
      if (action === "publish") {
        console.log(`[${requestId}] 🟢 ENTRÓ al bloque PUBLISH`);
        
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => String(a.numeroArticulo) === String(articleNumber));
        
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const articleToPublish = updatedArticles[index];
        console.log(`[${requestId}] 📝 Publicando artículo #${articleNumber}: ${articleToPublish.titulo}`);

        // SOLO actualizar estado - SIN DOI
        articleToPublish.status = "published";
        articleToPublish.publishedAt = new Date().toISOString();
        articleToPublish.updatedAt = new Date().toISOString();
        articleToPublish.updatedBy = user.uid;
        articleToPublish.publishedBy = user.uid;

        updatedArticles[index] = articleToPublish;
        responseData = { 
          success: true,
          articleNumber: articleNumber,
          message: "Artículo publicado exitosamente"
          // SIN DOI
        };
        
        console.log(`[${requestId}] 🟢 PUBLISH completado.`);
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
// ===================== TRIGGER CORREGIDO CON PERMISOS DE DRIVE =====================
exports.onReviewerInvitationUpdated = onDocumentUpdated(
  {
    document: 'reviewerInvitations/{invitationId}',
    secrets: [OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN], // AÑADE ESTOS SECRETS
    memory: '512MiB' // Aumenta memoria para manejar Drive
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invitationId = event.params.invitationId;

    // Solo proceder si el estado cambió de 'pending' a 'accepted'
    if (beforeData.status !== 'pending' || afterData.status !== 'accepted') {
      return;
    }

    console.log(`📝 [onReviewerInvitationUpdated] Invitación ${invitationId} ACEPTADA. Otorgando permisos...`);

    try {
      const db = admin.firestore();

      // 1. Obtener el submission para conocer la carpeta editorial
      const submissionDoc = await db.collection('submissions').doc(afterData.submissionId).get();
      if (!submissionDoc.exists) {
        console.error(`❌ Submission no encontrado: ${afterData.submissionId}`);
        return;
      }
      const submission = submissionDoc.data();

      // 2. Verificar que existe la carpeta editorial
      if (!submission.editorialFolderId) {
        console.error(`❌ El submission ${afterData.submissionId} no tiene editorialFolderId`);
        return;
      }

      // 3. Inicializar Drive (necesita los secrets)
      const drive = await getDriveClient(`invitation-${invitationId}`);

      // 4. OTORGAR PERMISOS AL REVISOR EN LA CARPETA EDITORIAL
      console.log(`🔑 Otorgando permisos a ${afterData.reviewerEmail} en carpeta ${submission.editorialFolderId}`);
      
      try {
        await drive.permissions.create({
          fileId: submission.editorialFolderId,
          requestBody: {
            role: 'reader', // Permiso de solo lectura para revisores
            type: 'user',
            emailAddress: afterData.reviewerEmail
          },
          sendNotificationEmail: false // No enviar notificación de Drive para no confundir
        });
        console.log(`✅ Permisos otorgados exitosamente a ${afterData.reviewerEmail}`);
      } catch (permError) {
        console.error(`❌ Error otorgando permisos:`, permError.message);
        // No detenemos el flujo, pero registramos el error
        await logSystemError('drive_permission_error', permError, {
          invitationId,
          reviewerEmail: afterData.reviewerEmail,
          folderId: submission.editorialFolderId
        });
      }

      // 5. Crear la asignación (reviewerAssignment)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 21); // 21 días desde ahora

      const assignmentData = {
        submissionId: afterData.submissionId,
        editorialReviewId: afterData.editorialReviewId,
        editorialTaskId: afterData.editorialTaskId,
        round: afterData.round,
        reviewerUid: afterData.reviewerUid,
        reviewerEmail: afterData.reviewerEmail,
        reviewerName: afterData.reviewerName,
        invitationId: invitationId,
        status: 'pending',
        conflictOfInterest: afterData.conflictOfInterest,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
        
        // Guardar también la referencia a la carpeta editorial
        driveFolderId: submission.editorialFolderId,
        driveFolderUrl: submission.editorialFolderUrl
      };

      await db.collection('reviewerAssignments').add(assignmentData);
      console.log(`✅ Asignación creada para revisor ${afterData.reviewerEmail}`);

      // 6. Enviar email con instrucciones (incluyendo el enlace directo a Drive)
      await sendReviewerAssignmentEmail({
        ...afterData,
        driveFolderUrl: submission.editorialFolderUrl,
        submissionTitle: submission.title
      });

    } catch (error) {
      console.error(`❌ Error en onReviewerInvitationUpdated:`, error.message);
      await logSystemError('onReviewerInvitationUpdated', error, { invitationId, ...afterData });
    }
  }
);



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
      const driveFolderUrl = assignment.driveFolderUrl || submission.editorialFolderUrl;
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
      </div>
      <p>Debes ingresar al portal para entrar al workspace y dejar tus revisiones</p>
      <p><strong>Acceso al manuscrito:</strong></p>
      <p>Ya tienes acceso a la carpeta de Google Drive con el manuscrito y materiales complementarios:</p>
      <p>Puedes dejar comentarios en la carpeta. El editor los tomará en cuenta. Pero asegurate de incluirlos en tus comentarios al autor.</p>
      <div class="button-container">
        <a href="${driveFolderUrl}" class="btn">VER MANUSCRITO EN DRIVE</a>
      </div>
      
      <p>Por favor, completa tu revisión antes de la fecha límite. Utiliza el siguiente enlace para enviar tu informe:</p>
      
      <div class="button-container">
        <a href="${baseUrl}/reviewer-workspace/${assignment.id}" class="btn btn-secondary">ENVIAR REVISIÓN</a>
      </div>
      
      <p class="info-text">
        <strong>Nota:</strong> Ya deberías tener acceso a la carpeta de Drive. Si no puedes acceder, 
        <a href="mailto:contact@revistacienciasestudiantes.com">contáctanos</a>.
      </p>
    `
    : `
      <p>Thank you for accepting the invitation to review the following article:</p>
      <div class="highlight-box">
        <p class="article-title">"${submission.title}"</p>
      </div>
      <p>You must login in the portal in order to see the workspace and complete your assignment</p>
      
      <p><strong>Access to manuscript:</strong></p>
      <p>You now have access to the Google Drive folder with the manuscript and supplementary materials:</p>
      <p>You can leave comments in the document. The editor will consider them. But make sure to include them in your comments to the author.</p>
      <div class="button-container">
        <a href="${driveFolderUrl}" class="btn">VIEW MANUSCRIPT ON DRIVE</a>
      </div>
      
      <p>Please complete your review by the deadline. Use the following link to submit your report:</p>
      
      <div class="button-container">
        <a href="${baseUrl}/reviewer-workspace/${assignment.id}" class="btn btn-secondary">SUBMIT REVIEW</a>
      </div>
      
      <p class="info-text">
        <strong>Note:</strong> You should already have access to the Drive folder. If you cannot access it, 
        <a href="mailto:contact@revistacienciasestudiantes.com">contact us</a>.
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

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentCreatedEmail:`, error.message);
      await logSystemError('onReviewerAssignmentCreatedEmail', error, { assignmentId });
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
    secrets: [], // Los secrets se manejan dentro de sendEmailViaExtension
    memory: '256MiB'
  },
  async (event) => {
    // Datos de la nueva asignación que se acaba de crear (el revisor acaba de aceptar)
    const newAssignment = event.data.data();
    const newAssignmentId = event.params.assignmentId;

    console.log(`🆕 [onReviewerAssignmentCreated] NUEVA ASIGNACIÓN CREADA (revisor aceptó): ${newAssignmentId}. Verificando si se alcanza el mínimo...`);

    // Como el documento SOLO se crea cuando acepta, no necesitamos verificar status.
    // Su creación ya es la confirmación de aceptación.

    try {
      const db = admin.firestore();
      const taskId = newAssignment.editorialTaskId;

      if (!taskId) {
        console.warn(`⚠️ La asignación ${newAssignmentId} no tiene editorialTaskId. No se puede verificar el mínimo.`);
        return;
      }

      // 1. Obtener la tarea editorial para conocer el mínimo requerido
      const taskRef = db.collection('editorialTasks').doc(taskId);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        console.error(`❌ Tarea editorial no encontrada: ${taskId}`);
        return;
      }
      const taskData = taskSnap.data();

      // 2. Definir el mínimo de revisores necesarios (por defecto 2)
      const requiredReviewers = taskData.requiredReviewers || 2;
      console.log(`🎯 Mínimo de revisores requeridos para la tarea ${taskId}: ${requiredReviewers}`);

      // 3. Contar cuántas asignaciones (aceptaciones) hay para esta tarea
      //    INCLUYENDO la que acaba de crear el trigger
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .get(); // SIN filtro por status, porque todas las que existen son aceptaciones

      const acceptedCount = assignmentsSnapshot.size;
      console.log(`📊 Total de revisiones ACEPTADAS (documentos existentes) para la tarea ${taskId}: ${acceptedCount}`);

      // 4. Si se alcanza o supera el mínimo, proceder
      if (acceptedCount >= requiredReviewers) {
        console.log(`✅ MÍNIMO ALCANZADO (${acceptedCount}/${requiredReviewers}) para la tarea ${taskId}. Iniciando revisión por pares.`);

        const submissionRef = db.collection('submissions').doc(taskData.submissionId);
        const submissionSnap = await submissionRef.get();

        if (!submissionSnap.exists) {
          console.error(`❌ Submission no encontrado: ${taskData.submissionId}`);
          return;
        }
        const submissionData = submissionSnap.data();

        // 5. ACTUALIZAR ESTADOS (SOLO UNA VEZ)
        await db.runTransaction(async (transaction) => {
          // Leer el estado actual de la tarea dentro de la transacción
          const taskTxSnap = await transaction.get(taskRef);
          if (!taskTxSnap.exists) return;
          
          const currentTaskStatus = taskTxSnap.data().status;

          // Solo actualizar si la tarea sigue en 'reviewer-selection'
          // Esto evita procesar múltiples veces si varias aceptaciones llegan casi al mismo tiempo
          if (currentTaskStatus === 'reviewer-selection') {
            // Actualizar Tarea
            transaction.update(taskRef, {
              status: 'reviews-in-progress', // Pasa a la siguiente fase
              acceptedReviewers: acceptedCount,
              minimumReviewersReachedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Actualizar Submission
            transaction.update(submissionRef, {
              status: 'in-peer-review', // El artículo ahora está siendo revisado por pares
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Transacción exitosa: Tarea ${taskId} y submission ${taskData.submissionId} avanzaron.`);
          } else {
            console.log(`⏭️ La tarea ${taskId} ya no está en 'reviewer-selection' (actual: ${currentTaskStatus}). Probablemente ya se inició la revisión.`);
          }
        });

        // --- ENVIAR NOTIFICACIÓN AL EDITOR ---
        console.log(`📧 Notificando al editor (${taskData.assignedToEmail}) que la revisión por pares ha comenzado...`);

        const lang = submissionData.paperLanguage || 'es';
        const isSpanish = lang === 'es';

        // Construir lista de revisores asignados
        let reviewersListHtml = '<ul>';
        assignmentsSnapshot.docs.forEach(doc => {
          const reviewer = doc.data();
          reviewersListHtml += `<li><strong>${reviewer.reviewerName || 'Revisor'}</strong> (${reviewer.reviewerEmail})</li>`;
        });
        reviewersListHtml += '</ul>';

        const emailTitle = isSpanish
          ? `✅ Revisión por pares iniciada: "${submissionData.title.substring(0, 60)}..."`
          : `✅ Peer review started: "${submissionData.title.substring(0, 60)}..."`;

        const emailGreeting = isSpanish
          ? `Estimado/a ${taskData.assignedToName || 'Editor/a'}:`
          : `Dear ${taskData.assignedToName || 'Editor'}:`;

        const bodyContent = isSpanish
          ? `
            <p>El artículo <strong>"${submissionData.title}"</strong> ha alcanzado el mínimo de <strong>${requiredReviewers} revisores aceptados</strong> y ha pasado automáticamente a la fase de <strong>revisión por pares</strong>.</p>

            <div class="highlight-box">
              <p class="article-title">"${submissionData.title}"</p>
              <p><strong>ID del envío:</strong> ${submissionData.submissionId}</p>
              <p><strong>Área:</strong> ${submissionData.area}</p>
              <p><strong>Autor/a:</strong> ${submissionData.authorName}</p>
            </div>

            <h3>📋 Revisores asignados (${acceptedCount}):</h3>
            ${reviewersListHtml}

            <p>El sistema notificará automáticamente cuando se completen las revisiones.</p>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/editorial/task/${taskId}" class="btn">VER TAREA</a>
            </div>
          `
          : `
            <p>The article <strong>"${submissionData.title}"</strong> has reached the minimum of <strong>${requiredReviewers} accepted reviewers</strong> and has automatically moved to the <strong>peer review</strong> phase.</p>

            <div class="highlight-box">
              <p class="article-title">"${submissionData.title}"</p>
              <p><strong>Submission ID:</strong> ${submissionData.submissionId}</p>
              <p><strong>Area:</strong> ${submissionData.area}</p>
              <p><strong>Author:</strong> ${submissionData.authorName}</p>
            </div>

            <h3>📋 Assigned reviewers (${acceptedCount}):</h3>
            ${reviewersListHtml}

            <p>The system will automatically notify you when reviews are completed.</p>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/editorial/task/${taskId}" class="btn">VIEW TASK</a>
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

        await sendEmailViaExtension(taskData.assignedToEmail, emailTitle, htmlBody);
        console.log(`✅ Notificación enviada a editor ${taskData.assignedToEmail}`);

        // Registrar en audit log
        await db.collection('submissions').doc(taskData.submissionId)
          .collection('auditLogs').add({
            action: 'peer_review_started',
            details: `Iniciado automáticamente al alcanzar ${acceptedCount} aceptaciones de revisores.`,
            taskId: taskId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

      } else {
        console.log(`⏳ Aún no se alcanza el mínimo (${acceptedCount}/${requiredReviewers}). Se necesitan ${requiredReviewers - acceptedCount} más.`);
      }

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentCreated:`, error.message);
      console.error(error.stack);
      await logSystemError('onReviewerAssignmentCreated', error, {
        newAssignmentId,
        newAssignmentData: newAssignment
      });
    }
  }
);

// ===================== MEJORA: TRIGGER PARA CUANDO SE COMPLETA UNA REVISIÓN =====================
// ===================== TRIGGER: CUANDO SE COMPLETA UNA REVISIÓN (CON EMAIL AL EDITOR) =====================
exports.onReviewerAssignmentSubmitted = onDocumentUpdated(
  {
    document: 'reviewerAssignments/{assignmentId}',
    secrets: [], // Los secrets se manejan en sendEmailViaExtension
    memory: '256MiB'
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const assignmentId = event.params.assignmentId;

    // Solo nos interesa cuando el estado CAMBIA a 'submitted'
    if (beforeData.status === afterData.status || afterData.status !== 'submitted') {
      console.log(`⏭️ [onReviewerAssignmentSubmitted] No hay cambio a 'submitted' (estado actual: ${afterData.status}). Saliendo.`);
      return;
    }

    console.log(`📝 [onReviewerAssignmentSubmitted] NUEVA REVISIÓN COMPLETADA: ${assignmentId} para el revisor ${afterData.reviewerEmail}`);

    try {
      const db = admin.firestore();
      const taskId = afterData.editorialTaskId;
      
      if (!taskId) {
        console.warn('⚠️ La asignación no tiene editorialTaskId. No se puede procesar.');
        return;
      }

      // 1. Obtener la tarea editorial para conocer el mínimo requerido
      const taskRef = db.collection('editorialTasks').doc(taskId);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        console.error(`❌ Tarea editorial no encontrada: ${taskId}`);
        return;
      }
      const taskData = taskSnap.data();

      // 2. Obtener el submission asociado
      const submissionRef = db.collection('submissions').doc(taskData.submissionId);
      const submissionSnap = await submissionRef.get();
      
      if (!submissionSnap.exists) {
        console.error(`❌ Submission no encontrado: ${taskData.submissionId}`);
        return;
      }
      const submissionData = submissionSnap.data();

      // 3. Contar cuántas asignaciones COMPLETADAS (submitted) hay para esta tarea (INCLUYENDO la actual)
      const assignmentsSnapshot = await db.collection('reviewerAssignments')
        .where('editorialTaskId', '==', taskId)
        .where('status', '==', 'submitted')
        .get();

      const submittedCount = assignmentsSnapshot.size;
      const requiredReviews = taskData.requiredReviews || 2; // Mínimo de revisiones necesarias
      
      console.log(`📊 Revisiones completadas para tarea ${taskId}: ${submittedCount} de ${requiredReviews} requeridas`);

      // Registrar en audit log que se recibió una revisión
      await db.collection('submissions').doc(taskData.submissionId)
        .collection('auditLogs').add({
          action: 'review_submitted',
          details: `Revisión recibida de ${afterData.reviewerName || afterData.reviewerEmail}`,
          reviewerId: assignmentId,
          recommendation: afterData.recommendation,
          round: taskData.round || 1,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      // 4. SI SE ALCANZA EL MÍNIMO DE REVISIONES COMPLETADAS, AVANZAR AL SIGUIENTE ESTADO
      if (submittedCount >= requiredReviews) {
        console.log(`🎯 MÍNIMO DE REVISIONES ALCANZADO (${submittedCount}/${requiredReviews}) para tarea ${taskId}`);

        // Usar transacción para actualizar tarea y submission de forma atómica
        await db.runTransaction(async (transaction) => {
          // Leer el estado actual de la tarea dentro de la transacción
          const taskTxSnap = await transaction.get(taskRef);
          if (!taskTxSnap.exists) return;
          
          const currentTaskStatus = taskTxSnap.data().status;
          
          // Solo actualizar si la tarea está en el estado correcto (reviews-in-progress)
          // Esto evita que se procese múltiples veces
          if (currentTaskStatus === 'reviews-in-progress') {
            
            // Actualizar Tarea a 'awaiting-decision'
            transaction.update(taskRef, {
              status: 'awaiting-decision',
              reviewsCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
              completedReviews: submittedCount,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Actualizar Submission a 'awaiting-editor-decision'
            transaction.update(submissionRef, {
              status: 'awaiting-editor-decision',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`✅ Transacción: Tarea ${taskId} y submission ${taskData.submissionId} avanzaron a 'awaiting-decision' / 'awaiting-editor-decision'.`);
          } else {
            console.log(`⏭️ La tarea ${taskId} ya no está en 'reviews-in-progress' (actual: ${currentTaskStatus}). Probablemente ya se procesó.`);
          }
        });

        // --- ENVIAR EMAIL COMPLETO AL EDITOR (FUERA DE LA TRANSACCIÓN) ---
        console.log(`📧 Preparando email de decisión pendiente para el editor (${taskData.assignedToEmail})...`);

        const lang = submissionData.paperLanguage || 'es';
        const isSpanish = lang === 'es';

        // --- CONSTRUIR LISTA DETALLADA DE REVISIONES COMPLETADAS ---
        let reviewsListHtml = '';
        let recommendationSummary = { accept: 0, minor: 0, major: 0, reject: 0 };

        assignmentsSnapshot.docs.forEach((doc, index) => {
          const review = doc.data();
          
          // Mapear la recomendación a un formato legible
          let recommendationText = review.recommendation || 'No especificada';
          if (isSpanish) {
            const recMap = {
              'accept': 'Aceptar',
              'minor-revision': 'Revisiones menores',
              'major-revision': 'Revisiones mayores',
              'reject': 'Rechazar'
            };
            recommendationText = recMap[review.recommendation] || recommendationText;
          } else {
            const recMap = {
              'accept': 'Accept',
              'minor-revision': 'Minor revisions',
              'major-revision': 'Major revisions',
              'reject': 'Reject'
            };
            recommendationText = recMap[review.recommendation] || recommendationText;
          }

          // Contar para el resumen
          if (review.recommendation === 'accept') recommendationSummary.accept++;
          else if (review.recommendation === 'minor-revision') recommendationSummary.minor++;
          else if (review.recommendation === 'major-revision') recommendationSummary.major++;
          else if (review.recommendation === 'reject') recommendationSummary.reject++;

          // Extraer puntuaciones si existen
          const scores = review.scores || {};
          const scoresHtml = Object.keys(scores).length > 0 
            ? `<p><strong>Puntuaciones:</strong> ${Object.entries(scores).map(([k, v]) => `${k}: ${v}`).join(' | ')}</p>`
            : '';

          reviewsListHtml += `
            <div style="background-color: #f9f9f9; padding: 15px; margin-bottom: 15px; border-left: 4px solid #007398; border-radius: 4px;">
              <p><strong>Revisor ${index + 1}:</strong> ${review.reviewerName || 'Anónimo'} (${review.reviewerEmail})</p>
              <p><strong>Recomendación:</strong> <span style="font-weight: bold; color: ${getRecommendationColor(review.recommendation)}">${recommendationText}</span></p>
              ${scoresHtml}
              <p><strong>Comentarios para el autor:</strong><br>${(review.commentsToAuthor || 'Sin comentarios').substring(0, 300)}${(review.commentsToAuthor || '').length > 300 ? '...' : ''}</p>
              ${review.commentsToEditor ? `<p><strong>Comentarios confidenciales:</strong><br>${review.commentsToEditor.substring(0, 200)}${review.commentsToEditor.length > 200 ? '...' : ''}</p>` : ''}
              <p><small>Enviado: ${review.submittedAt?.toDate()?.toLocaleString(isSpanish ? 'es-CL' : 'en-US') || 'Fecha no disponible'}</small></p>
            </div>
          `;
        });

        // --- RESUMEN DE RECOMENDACIONES ---
        const summaryHtml = isSpanish
          ? `
            <div style="display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap;">
              <div style="background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Aceptar:</strong> ${recommendationSummary.accept}
              </div>
              <div style="background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Revisiones menores:</strong> ${recommendationSummary.minor}
              </div>
              <div style="background-color: #ffe5b4; color: #8a6d3b; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Revisiones mayores:</strong> ${recommendationSummary.major}
              </div>
              <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Rechazar:</strong> ${recommendationSummary.reject}
              </div>
            </div>
          `
          : `
            <div style="display: flex; gap: 10px; margin: 20px 0; flex-wrap: wrap;">
              <div style="background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Accept:</strong> ${recommendationSummary.accept}
              </div>
              <div style="background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Minor revisions:</strong> ${recommendationSummary.minor}
              </div>
              <div style="background-color: #ffe5b4; color: #8a6d3b; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Major revisions:</strong> ${recommendationSummary.major}
              </div>
              <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; flex: 1; text-align: center;">
                <strong>Reject:</strong> ${recommendationSummary.reject}
              </div>
            </div>
          `;

        // --- CONSTRUIR EL EMAIL ---
        const emailTitle = isSpanish
          ? `📋 Revisiones completadas: "${submissionData.title.substring(0, 60)}..."`
          : `📋 Reviews completed: "${submissionData.title.substring(0, 60)}..."`;

        const emailGreeting = isSpanish
          ? `Estimado/a ${taskData.assignedToName || 'Editor/a'}:`
          : `Dear ${taskData.assignedToName || 'Editor'}:`;

        const bodyContent = isSpanish
          ? `
            <p>El artículo <strong>"${submissionData.title}"</strong> ha recibido las <strong>${submittedCount} revisiones requeridas</strong> y está listo para tu decisión editorial.</p>

            <div class="highlight-box">
              <p class="article-title">"${submissionData.title}"</p>
              <p><strong>ID del envío:</strong> ${submissionData.submissionId}</p>
              <p><strong>Área:</strong> ${submissionData.area}</p>
              <p><strong>Autor/a:</strong> ${submissionData.authorName} (${submissionData.authorEmail})</p>
              <p><strong>Ronda actual:</strong> ${taskData.round || 1}</p>
            </div>

            <h3>📊 Resumen de recomendaciones:</h3>
            ${summaryHtml}

            <h3>📋 Detalle de las revisiones recibidas:</h3>
            ${reviewsListHtml}

            <h3>🔍 Próximos pasos:</h3>
            <ol>
              <li><strong>Revisa los informes:</strong> Analiza las recomendaciones y comentarios de los revisores.</li>
              <li><strong>Toma una decisión:</strong> Puedes optar por: aceptar, solicitar revisiones menores/mayores, o rechazar el artículo.</li>
              <li><strong>Redacta tu decisión:</strong> Prepara una carta de decisión para el autor, incorporando los comentarios de los revisores.</li>
              <li><strong>Notifica al autor:</strong> Una vez que tomes la decisión, el sistema notificará automáticamente al autor.</li>
            </ol>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/login" class="btn">TOMAR DECISIÓN</a>
              <a href="${submissionData.driveFolderUrl}" class="btn btn-secondary">VER CARPETA EN DRIVE</a>
            </div>

            <p class="info-text">
              <strong>Nota:</strong> Una vez que tomes la decisión, el sistema actualizará automáticamente el estado del envío y notificará al autor.
            </p>
          `
          : `
            <p>The article <strong>"${submissionData.title}"</strong> has received the <strong>${submittedCount} required reviews</strong> and is ready for your editorial decision.</p>

            <div class="highlight-box">
              <p class="article-title">"${submissionData.title}"</p>
              <p><strong>Submission ID:</strong> ${submissionData.submissionId}</p>
              <p><strong>Area:</strong> ${submissionData.area}</p>
              <p><strong>Author:</strong> ${submissionData.authorName} (${submissionData.authorEmail})</p>
              <p><strong>Current round:</strong> ${taskData.round || 1}</p>
            </div>

            <h3>📊 Recommendation summary:</h3>
            ${summaryHtml}

            <h3>📋 Review details:</h3>
            ${reviewsListHtml}

            <h3>🔍 Next steps:</h3>
            <ol>
              <li><strong>Review the reports:</strong> Analyze the reviewers' recommendations and comments.</li>
              <li><strong>Make a decision:</strong> You can choose to: accept, request minor/major revisions, or reject the article.</li>
              <li><strong>Draft your decision:</strong> Prepare a decision letter for the author, incorporating the reviewers' comments.</li>
              <li><strong>Notify the author:</strong> Once you make the decision, the system will automatically notify the author.</li>
            </ol>

            <div class="button-container">
              <a href="https://www.revistacienciasestudiantes.com/${isSpanish ? 'es' : 'en'}/login" class="btn">MAKE DECISION</a>
              <a href="${submissionData.driveFolderUrl}" class="btn btn-secondary">VIEW DRIVE FOLDER</a>
            </div>

            <p class="info-text">
              <strong>Note:</strong> Once you make the decision, the system will automatically update the submission status and notify the author.
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

        // Enviar el email
        await sendEmailViaExtension(taskData.assignedToEmail, emailTitle, htmlBody);
        console.log(`✅ Email de decisión pendiente enviado a editor ${taskData.assignedToEmail}`);

        // Registrar envío de notificación
        await db.collection('submissions').doc(taskData.submissionId)
          .collection('auditLogs').add({
            action: 'editor_notified_decision_pending',
            details: `Editor ${taskData.assignedToEmail} notificado sobre revisiones completadas`,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

      } else {
        // No se ha alcanzado el mínimo aún, pero podemos notificar al editor que llegó una nueva revisión (opcional)
        console.log(`📨 Notificación opcional: Se recibió una revisión (${submittedCount}/${requiredReviews}) para la tarea ${taskId}`);
        
        // Opcional: Enviar un email de "progreso" al editor
        // await sendProgressNotification(taskData, submissionData, submittedCount, requiredReviews);
      }

    } catch (error) {
      console.error(`❌ Error en onReviewerAssignmentSubmitted:`, error.message);
      console.error(error.stack);
      await logSystemError('onReviewerAssignmentSubmitted', error, { 
        assignmentId,
        afterData: {
          submissionId: afterData?.submissionId,
          editorialTaskId: afterData?.editorialTaskId,
          reviewerEmail: afterData?.reviewerEmail
        }
      });
    }
  }
);

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