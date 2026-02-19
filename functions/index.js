"use strict";

/* ===================== IMPORTS ===================== */
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");

// IMPORTANTE: Aumentamos el timeout y la memoria para evitar el error de carga
setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
  timeoutSeconds: 120, // Aumentamos el timeout
  memory: "512MiB" // Aumentamos la memoria
});

const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { GoogleGenAI } = require("@google/genai");
const { Octokit } = require("@octokit/rest");
const FormData = require("form-data");
const fetch = require("node-fetch");
const { google } = require("googleapis");
// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

/* ===================== CONFIG ===================== */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const IMGBB_API_KEY = defineSecret("IMGBB_API_KEY");
const GH_TOKEN = defineSecret("GH_TOKEN");
const DRIVE_SERVICE_ACCOUNT = defineSecret("DRIVE_SERVICE_ACCOUNT");
const OAUTH2_CLIENT_ID = defineSecret('OAUTH2_CLIENT_ID');
const OAUTH2_CLIENT_SECRET = defineSecret('OAUTH2_CLIENT_SECRET');
const OAUTH2_REFRESH_TOKEN = defineSecret('OAUTH2_REFRESH_TOKEN');
 // <-- NUEVO

const DOMAIN = "https://www.revistacienciasestudiantes.com";
const ALLOWED_ORIGINS = [
  DOMAIN,
  "https://revistacienciasestudiantes.com",
  "http://localhost:3000",
  "http://localhost:5000"
];

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
  'Institución Colaboradora': 'Partner Institution'
};

/* ===================== UTILIDADES ===================== */
function handleCors(req, res) {
  const origin = req.headers.origin;
  
  // Configurar headers CORS
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    res.set("Access-Control-Allow-Origin", DOMAIN);
  }
  
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, Accept");
  res.set("Access-Control-Max-Age", "3600"); // Cache preflight por 1 hora
  res.set("Vary", "Origin");

  // Manejar preflight request
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
  return new Octokit({ auth: GH_TOKEN.value() }); 
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
/* ===================== GEMINI CON CORRECCIÓN ===================== */
async function callGemini(prompt, temperature = 0) {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  // ✅ CORRECCIÓN: Usar el nuevo SDK @google/genai correctamente
  const ai = new GoogleGenAI({ apiKey });

  // ✅ El método correcto es ai.models.generateContent
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      temperature: temperature,
      maxOutputTokens: 4096
    }
  });

  // ✅ La respuesta también es diferente
  let text = result.text?.trim() || "";
  
  // Limpiar si viene con markdown
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
You are a faithful translator for an academic journal.

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

/* ===================== IMGBB UPLOAD ===================== */// EN index.js - AÑADE ESTA FUNCIÓN
exports.uploadImageToImgBBCallable = onCall(
  { secrets: [IMGBB_API_KEY] },
  async (request) => {
    const { auth } = request;

    // 🔐 Solo verificar que esté autenticado
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes estar logueado');
    }

    const { imageBase64, name, expiration } = request.data;

    if (!imageBase64) {
      throw new HttpsError('invalid-argument', 'Falta imageBase64');
    }

    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const form = new FormData();
      form.append("image", cleanBase64);
      if (name) form.append("name", name);

      const url = new URL("https://api.imgbb.com/1/upload");
      url.searchParams.set("key", IMGBB_API_KEY.value());
      if (expiration) {
        url.searchParams.set("expiration", String(expiration));
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        body: form,
        headers: form.getHeaders()
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
    // Manejar CORS
    if (handleCors(req, res)) return;

    // Solo aceptar POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    // Validar origen
    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    try {
      // Verificar autenticación
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

      // Validar rol - REQUERIDO para esta función
      try {
        await validateRole(user.uid, "Director General");
      } catch (roleError) {
        return res.status(403).json({ error: "Se requiere rol de Director General" });
      }

      // Validar datos de entrada
      const { title, body, photo, language = "es" } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({ error: "Faltan datos: title y body son requeridos" });
      }

      // Procesar traducción
      const source = language.toLowerCase();
      const target = source === "es" ? "en" : "es";

      const titleSource = sanitizeInput(title);
      const bodySource = base64DecodeUnicode(body) || sanitizeInput(body);

      // Traducir título y cuerpo
      const titleTarget = await translateText(titleSource, source, target);
      const bodyTarget = await translateHtmlFragmentWithSplit(bodySource, source, target);

      // Guardar en Firestore
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
/* ===================== MANAGE ARTICLES ===================== */
exports.manageArticles = onRequest(
  { 
    secrets: [GH_TOKEN],
    cors: true,
    timeoutSeconds: 120
  },
  async (req, res) => {
    // ========== 1. MANEJO CORS ==========
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

      console.log(`[${requestId}] 📋 Acción: ${action}, ID: ${id || 'nuevo'}`);

      // ========== CONFIGURACIÓN GITHUB ==========
      const octokit = getOctokit();
      const REPO_OWNER = "revista1919";
      const REPO_NAME = "articless"; // Repositorio donde está articles.json
      const JSON_PATH = "articles.json";
      const BRANCH = "main";

      // ========== FUNCIONES AUXILIARES ==========
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
            // Si no existe, crear array vacío
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
          // Actualizar archivo existente
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
          // Crear archivo nuevo
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

      // ========== PROCESAR AUTORES CON SUS IDs ==========
      function processAuthors(authorsInput) {
        // authorsInput puede ser:
        // 1. String "Nombre1 Apellido1;Nombre2 Apellido2"
        // 2. Array de strings ["Nombre1 Apellido1", "Nombre2 Apellido2"]
        // 3. Array de objetos [{ name: "...", authorId: "..." }, ...]
        
        let authorsArray = [];
        
        if (typeof authorsInput === 'string') {
          // Caso 1: string separado por punto y coma
          authorsArray = authorsInput.split(';').map(name => ({
            name: name.trim(),
            authorId: null
          }));
        } else if (Array.isArray(authorsInput)) {
          if (authorsInput.length === 0) return [];
          
          if (typeof authorsInput[0] === 'string') {
            // Caso 2: array de strings
            authorsArray = authorsInput.map(name => ({
              name: name.trim(),
              authorId: null
            }));
          } else {
            // Caso 3: array de objetos
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

      // Función para generar slug para PDF
      function generateSlug(text) {
        if (!text) return '';
        return text.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // ========== SUBIR PDF A REPO ARTICLES ==========
      async function uploadPDF(pdfBase64, fileName, commitMessage) {
        const content = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        
        await octokit.repos.createOrUpdateFileContents({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path: `pdfs/${fileName}`, // Guardamos PDFs en subcarpeta
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

      // ========== OBTENER SIGUIENTE NÚMERO DE ARTÍCULO ==========
      async function getNextArticleNumber(articles) {
        if (articles.length === 0) return 1;
        
        const maxNumber = Math.max(...articles.map(a => a.numeroArticulo || 0));
        return maxNumber + 1;
      }

      // ========== ACCIONES ==========
      
      // Obtener estado actual
      const { articles: currentArticles, sha } = await getCurrentArticlesJson();
      let updatedArticles = [...currentArticles];
      let responseData = {};

      // ========== ACCIÓN: ADD ==========
      if (action === "add") {
        if (!article?.titulo) {
          return res.status(400).json({ error: "Datos de artículo incompletos - título requerido" });
        }

        console.log(`[${requestId}] 📝 Creando nuevo artículo: ${article.titulo}`);

        // Procesar autores
        const authorsArray = processAuthors(article.autores);
        
        // Obtener siguiente número de artículo
        const articleNumber = await getNextArticleNumber(currentArticles);
        
        // Preparar objeto de artículo
        const newArticle = {
          numeroArticulo: articleNumber,
          titulo: article.titulo,
          tituloEnglish: article.tituloEnglish || '',
          autores: authorsArray, // AHORA ES UN ARRAY DE OBJETOS
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

        // Agregar a la lista
        updatedArticles.push(newArticle);
        responseData = { 
          id: articleNumber.toString(),
          articleNumber: articleNumber,
          message: "Artículo creado exitosamente"
        };
      }

      // ========== ACCIÓN: EDIT ==========
      if (action === "edit") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => a.numeroArticulo === articleNumber);
        
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const oldArticle = updatedArticles[index];
        console.log(`[${requestId}] 📝 Editando artículo #${articleNumber}: ${oldArticle.titulo}`);

        // Procesar autores (preservar IDs existentes si no se proporcionan nuevos)
        let authorsArray;
        if (article.autores) {
          authorsArray = processAuthors(article.autores);
          
          // Si los autores vienen como strings pero queremos preservar IDs antiguos
          if (typeof article.autores === 'string' || 
              (Array.isArray(article.autores) && typeof article.autores[0] === 'string')) {
            
            // Mapear nombres a IDs antiguos
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

        // Construir artículo actualizado
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

        // Manejar PDF nuevo
        if (pdfBase64) {
          try {
            // Eliminar PDF anterior si existe
            if (oldArticle.pdfUrl) {
              const oldFileName = oldArticle.pdfUrl.split('/').pop();
              console.log(`[${requestId}] 🗑️ Eliminando PDF anterior: ${oldFileName}`);
              
              await deletePDF(
                oldFileName,
                `Delete old PDF for article #${articleNumber}: ${updatedArticle.titulo}`
              );
            }

            // Subir nuevo PDF
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

        // Reemplazar en la lista
        updatedArticles[index] = updatedArticle;
        responseData = { 
          success: true,
          articleNumber: articleNumber,
          message: "Artículo actualizado exitosamente"
        };
      }

      // ========== ACCIÓN: DELETE ==========
      if (action === "delete") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const articleNumber = parseInt(id);
        const index = updatedArticles.findIndex(a => a.numeroArticulo === articleNumber);
        
        if (index === -1) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const articleToDelete = updatedArticles[index];
        console.log(`[${requestId}] 🗑️ Eliminando artículo #${articleNumber}: ${articleToDelete.titulo}`);

        // Eliminar PDF si existe
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

        // Eliminar de la lista
        updatedArticles.splice(index, 1);
        responseData = { 
          success: true,
          articleNumber: articleNumber,
          message: "Artículo eliminado exitosamente"
        };
      }

      // ========== GUARDAR CAMBIOS ==========
      if (action === "add" || action === "edit" || action === "delete") {
        // Ordenar artículos por número
        updatedArticles.sort((a, b) => (a.numeroArticulo || 0) - (b.numeroArticulo || 0));
        
        const commitMessage = `[${action}] Artículo ${action === 'add' ? 'agregado' : action === 'edit' ? 'actualizado' : 'eliminado'} #${responseData.articleNumber || ''} por ${user.email || user.uid}`;
        
        await saveArticlesJson(updatedArticles, sha, commitMessage);
        console.log(`[${requestId}] ✅ articles.json actualizado en GitHub`);

        // ========== TRIGGER REBUILD ==========
        try {
          // Disparar rebuild del sitio principal
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

        return res.json({ 
          success: true,
          ...responseData
        });
      }

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
    // Manejar CORS
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    try {
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
    // Manejar CORS
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origen no permitido" });
    }

    try {
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
    // Log de quién cambió qué
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
    const octokit = new Octokit({ auth: GH_TOKEN.value() });
    
    await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
      owner: 'revista1919',
      repo: 'team',
      event_type: 'rebuild-team-user',
      client_payload: {
        uid: event.params.userId
      }
    });
    
    console.log(`🚀 Disparado rebuild para usuario ${event.params.userId}`);
  }
);

// También escuchar creación de nuevos usuarios
exports.onUserCreate = onDocumentCreated(
  { document: 'users/{userId}', secrets: [GH_TOKEN] },
  async (event) => {
    const octokit = new Octokit({ auth: GH_TOKEN.value() });
    
    await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
      owner: 'revista1919',
      repo: 'team',
      event_type: 'rebuild-team-user',
      client_payload: {
        uid: event.params.userId
      }
    });
    
    console.log(`🚀 Nuevo usuario creado: ${event.params.userId}`);
  }
);
/* ===================== UPDATE ROLE ===================== */
/* ===================== UPDATE ROLE (CALLABLE) ===================== */
/* ===================== UPDATE ROLE (CALLABLE) ===================== */
exports.updateRole = onCall(async (request) => {
  const { auth, data } = request;

  // 🔐 Debe estar logueado
  if (!auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión");
  }

  const callerUid = auth.uid;

  try {
    /* ===================== VALIDAR PERMISOS ===================== */
    const callerUser = await admin.auth().getUser(callerUid);
    const callerRoles = callerUser.customClaims?.roles || [];

    if (!callerRoles.includes("Director General")) {
      throw new HttpsError(
        "permission-denied",
        "Solo Director General puede modificar roles"
      );
    }

    /* ===================== VALIDAR INPUT ===================== */
    const { targetUid, newRoles } = data;

    if (!targetUid) {
      throw new HttpsError("invalid-argument", "Falta targetUid");
    }

    if (!Array.isArray(newRoles)) {
      throw new HttpsError("invalid-argument", "newRoles debe ser un array");
    }

    /* ===================== ACTUALIZAR CLAIMS ===================== */
    await admin.auth().setCustomUserClaims(targetUid, {
      roles: newRoles,
    });

    /* ===================== ACTUALIZAR FIRESTORE ===================== */
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

    /* ===================== RESPUESTA ===================== */
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
}); // 👈 CORREGIDO: Aquí se cierra correctamente la función updateRole
/* ===================== DRIVE HELPERS ===================== */
// ===================== CHECK ANONYMOUS PROFILE =====================
exports.checkAnonymousProfile = onCall(async (request) => {
  const { HttpsError } = require("firebase-functions/v2/https");
  
  try {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    
    const uid = request.auth.uid;
    const db = admin.firestore();
    
    // Obtener email del usuario
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }
    
    const userEmail = userDoc.data().email;
    if (!userEmail) {
      throw new HttpsError('failed-precondition', 'El usuario no tiene email');
    }
    
    // Buscar submissions donde este email aparezca como autor
    // pero SIN incluir usuarios que ya tienen UID (son registrados)
    const submissionsSnapshot = await db.collection('submissions')
      .where('status', 'in', ['published', 'accepted'])
      .get();
    
    let foundProfile = null;
    const crypto = require('crypto');
    
    submissionsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.authors && Array.isArray(data.authors)) {
        data.authors.forEach(author => {
          // Si el autor tiene UID, ya está registrado - ignorar
          if (author.uid) return;
          
          // Comparar emails (case insensitive)
          if (author.email && author.email.toLowerCase() === userEmail.toLowerCase()) {
            // Generar el mismo hash que usamos en build.js
            const claimHash = crypto.createHash('sha256')
              .update(author.email + '-revista-secret')
              .digest('hex')
              .substring(0, 16);
            
            // Crear identificador único para este perfil anónimo
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

// Helper para generar slug (copiar la misma función de build.js)
function generateSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// ===================== CLAIM ANONYMOUS PROFILE =====================
exports.claimAnonymousProfile = onCall(
  { secrets: [GH_TOKEN] },
  async (request) => {
    const { HttpsError } = require("firebase-functions/v2/https");
    const { Octokit } = require("@octokit/rest");
    
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
      }
      
      const uid = request.auth.uid;
      const { anonymousUid, claimHash, anonymousName } = request.data;
      
      if (!anonymousUid || !claimHash || !anonymousName) {
        throw new HttpsError('invalid-argument', 'Faltan datos');
      }
      
      const db = admin.firestore();
      const crypto = require('crypto');
      
      // 1. Verificar que el usuario actual existe
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Usuario no encontrado');
      }
      
      const userData = userDoc.data();
      const userEmail = userData.email;
      
      if (!userEmail) {
        throw new HttpsError('failed-precondition', 'El usuario no tiene email');
      }
      
      // 2. Verificar que el hash coincide
      const expectedHash = crypto.createHash('sha256')
        .update(userEmail + '-revista-secret')
        .digest('hex')
        .substring(0, 16);
      
      if (expectedHash !== claimHash) {
        throw new HttpsError('permission-denied', 'Hash de verificación inválido');
      }
      
      // 3. Buscar todas las submissions de este autor para actualizarlas
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
            // Si el email coincide y no tiene UID, asignarle el UID
            if (author.email && 
                author.email.toLowerCase() === userEmail.toLowerCase() && 
                !author.uid) {
              modified = true;
              articlesClaimed++;
              return {
                ...author,
                uid: uid, // Asignar el UID del usuario registrado
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
      
      // 4. Guardar en el usuario que ha reclamado
      batch.update(db.collection('users').doc(uid), {
        claimedAnonymousUid: anonymousUid,
        claimedAnonymousName: anonymousName,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        articlesClaimed: articlesClaimed,
        // Asegurar rol de Autor
        roles: admin.firestore.FieldValue.arrayUnion('Autor')
      });
      
      await batch.commit();
      
      console.log(`✅ Perfil reclamado: ${anonymousName} (${anonymousUid}) → ${uid} (${userEmail}) - ${articlesClaimed} artículos actualizados`);
      
      // 5. Disparar rebuild del equipo y artículos
      const octokit = new Octokit({ auth: GH_TOKEN.value() });
      
      // Rebuild del equipo (para actualizar perfil)
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
      
      // Rebuild de artículos (para actualizar enlaces)
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
async function getDriveClient() {
  console.log('🔧 Inicializando cliente de Drive...');
  
  try {
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
    
    return drive;
    
  } catch (error) {
    console.error('❌ Error inicializando Drive:', error.message);
    
    if (error.message.includes('invalid_grant')) {
      throw new Error('Refresh token inválido o expirado');
    }
    
    throw new Error(`Failed to initialize Drive: ${error.message}`);
  }
}

/**
 * Crea una carpeta en Google Drive
 * @param {google.drive} drive - Cliente de Drive inicializado
 * @param {string} folderName - Nombre de la carpeta
 * @param {string|null} parentId - ID de carpeta padre (opcional)
 * @returns {Promise<{id: string, webViewLink: string}>}
 */
/**
 * Crea una carpeta en Google Drive
 * @param {google.drive} drive - Cliente de Drive inicializado
 * @param {string} folderName - Nombre de la carpeta
 * @param {string|null} parentId - ID de carpeta padre (opcional)
 * @returns {Promise<{id: string, webViewLink: string}>}
 */
async function createDriveFolder(drive, folderName, parentId = null) {
  const folderOpId = `folder-${Date.now()}`;
  
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

/**
 * Sube un archivo a Google Drive
 * @param {google.drive} drive - Cliente de Drive inicializado
 * @param {string} fileBase64 - Archivo en base64
 * @param {string} fileName - Nombre del archivo
 * @param {string} folderId - ID de la carpeta destino
 * @returns {Promise<{id: string, webViewLink: string}>}
 */
async function uploadToDrive(drive, fileBase64, fileName, folderId) {
  const uploadId = `upload-${Date.now()}`;
  
  try {
    if (!fileBase64 || !fileName || !folderId) {
      throw new Error('Parámetros requeridos faltantes');
    }
    
    // Limpiar base64
    if (fileBase64.includes('base64,')) {
      fileBase64 = fileBase64.split('base64,')[1];
    }
    
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    
    // Validar tamaño (máx 10MB)
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
    
    // Configurar permisos públicos
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

/* ===================== EMAIL HELPERS ===================== */

/**
 * Encola un email para ser enviado vía extensión de Firebase
 * @param {string} to - Email destino
 * @param {string} subject - Asunto
 * @param {string} htmlBody - Cuerpo HTML
 * @returns {Promise<void>}
 */
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
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('mail').add(emailData);
  } catch (error) {
    console.error('❌ Error queueing email:', error.message);
  }
}

/**
 * Genera plantilla HTML para emails con diseño institucional
 * @param {string} title - Título del email
 * @param {string} greeting - Saludo personalizado
 * @param {string} body - Contenido principal
 * @param {string} signatureName - Nombre del firmante
 * @param {string} signatureTitle - Título del firmante
 * @param {string} lang - Idioma ('es' o 'en')
 * @returns {string} HTML completo
 */
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

/* ===================== VALIDATION HELPERS ===================== */

/**
 * Valida que un archivo sea un documento Word válido
 * @param {string} base64Header - Primeros bytes en base64
 * @returns {boolean}
 */
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

/**
 * Sanitiza texto para evitar XSS
 * @param {string} text 
 * @returns {string}
 */
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

/**
 * Función principal para envío de artículos
 * HTTP POST endpoint: /submitArticle
 */
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
      
      // Rate limiting simple
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

      const {
        title, titleEn, abstract, abstractEn, 
        keywords, keywordsEn, area, paperLanguage = 'es',
        authors, funding, conflictOfInterest,
        minorAuthors, excludedReviewers,
        manuscriptBase64, manuscriptName,
        authorEmail, authorName,
        articleType,          // ← NUEVO
        acknowledgments       // ← NUEVO
      } = req.body;

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

      let drive;
      try {
        drive = await getDriveClient();
      } catch (driveError) {
        return res.status(500).json({ 
          error: 'Error en servicio de almacenamiento',
          requestId
        });
      }

      const safeTitle = title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
      const folderName = `Submission_${submissionId}_${safeTitle}`;

      let folder;
      try {
        folder = await createDriveFolder(drive, folderName);
      } catch (folderError) {
        return res.status(500).json({ 
          error: 'Error creando carpeta en Drive',
          requestId
        });
      }

      const fileExt = manuscriptName?.endsWith('.docx') ? '.docx' : '.doc';
      const fileName = `ORIGINAL_${submissionId}${fileExt}`;

      let file;
      try {
        file = await uploadToDrive(drive, manuscriptBase64, fileName, folder.id);
      } catch (uploadError) {
        return res.status(500).json({ 
          error: 'Error subiendo archivo a Drive',
          requestId
        });
      }
// ================================================
// NUEVO: Permisos SOLO para editores (restringido)
// ================================================
console.log('🔒 Configurando permisos restringidos para editores...');

const editorSnapshotForPermissions = await db.collection('users')
  .where('roles', 'array-contains-any', ['Director General', 'Editor en Jefe'])
  .get();

const editorEmailsForPermissions = [];
editorSnapshotForPermissions.forEach(doc => {
  const data = doc.data();
  if (data.email) editorEmailsForPermissions.push(data.email);
});

// Fallback si no hay editores en la BD
if (editorEmailsForPermissions.length === 0) {
  editorEmailsForPermissions.push('contact@revistacienciasestudiantes.com');
}

for (const email of editorEmailsForPermissions) {
  try {
    await drive.permissions.create({
      fileId: folder.id,
      requestBody: {
        role: 'writer',           // writer = pueden ver, comentar, mover, añadir archivos
        type: 'user',
        emailAddress: email
      },
      sendNotificationEmail: false   // sin spam
    });
    console.log(`✅ Permiso writer otorgado a editor: ${email}`);
  } catch (permErr) {
    console.error(`❌ Error permiso para ${email}:`, permErr.message);
  }
}
// ================================================
      const crypto = require('crypto');
      const fileBuffer = Buffer.from(manuscriptBase64, 'base64');
      const integrityHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const processedAuthors = [];
      const consentFiles = [];

      // Procesar autores principales (incluye nueva contribución)
      for (const author of authors) {
        const authorData = {
          firstName: sanitizeText(author.firstName),
          lastName: sanitizeText(author.lastName),
          email: author.email,
          institution: sanitizeText(author.institution),
          orcid: author.orcid || null,
          contribution: sanitizeText(author.contribution || ''),   // ← NUEVO
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

      // PROCESAMIENTO DE CONSENTIMIENTOS DE MENORES (CORREGIDO - usa minorAuthors del frontend)
      if (Array.isArray(minorAuthors)) {
        for (const minor of minorAuthors) {
          if (minor.consentMethod === 'upload' && minor.consentFile?.data) {
            try {
              const consentFileName = `CONSENT_${minor.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
              const consentFile = await uploadToDrive(
                drive, 
                minor.consentFile.data, 
                consentFileName, 
                folder.id
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

      // Sanitizar minorAuthors (eliminar base64 grande antes de guardar en Firestore)
      const sanitizedMinorAuthors = (minorAuthors || []).map(m => ({
        name: sanitizeText(m.name),
        guardianName: sanitizeText(m.guardianName),
        consentMethod: m.consentMethod
        // NO guardamos el base64 del archivo aquí
      }));

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
        
        articleType: articleType ? sanitizeText(articleType) : null,           // ← NUEVO
        acknowledgments: acknowledgments ? sanitizeText(acknowledgments) : '', // ← NUEVO
        
        authors: processedAuthors,
        
        funding: funding || { hasFunding: false, sources: '', grantNumbers: '' },
        conflictOfInterest: conflictOfInterest ? sanitizeText(conflictOfInterest) : '',
        
        hasMinorAuthors: processedAuthors.some(a => a.isMinor),
        minorAuthors: sanitizedMinorAuthors,   // ← sanitizado
        consentFiles,
        
        excludedReviewers: excludedReviewers 
          ? excludedReviewers.split(';').map(r => sanitizeText(r.trim())).filter(Boolean)
          : [],
        
        originalFileId: file.id,
        originalFileUrl: file.webViewLink,
        originalFileName: fileName,
        originalFileHash: integrityHash,
        originalFileSize: fileBuffer.length,
        
        driveFolderId: folder.id,
        driveFolderUrl: folder.webViewLink,
        
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

        const articleInfo = `
          <div class="highlight-box">
            <p class="article-title">"${sanitizeText(title)}"</p>
            ${minorInfo}
            <p><strong>ID:</strong> ${submissionId}</p>
            <p><strong>Autor:</strong> ${sanitizeText(authorName)}</p>
            <p><strong>Email:</strong> ${authorEmailToUse}</p>
            <p><strong>Área:</strong> ${sanitizeText(area)}</p>
            <p><strong>Tipo de artículo:</strong> ${articleType ? articleType.toUpperCase() : 'No especificado'}</p>  <!-- ← NUEVO -->
            <p><strong>Idioma:</strong> ${paperLanguage === 'es' ? 'Español' : 'Inglés'}</p>
            ${fundingInfo}
            <p><strong>Autores (${authors.length}):</strong><br>${authorsList}</p>
          </div>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">VER EN PORTAL</a>
            <a href="${folder.webViewLink}" class="btn btn-secondary">CARPETA DRIVE</a>
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

      const authorBody = paperLanguage === 'es'
        ? `
          ${minorMessage}
          
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
          
          <p><em>Nota: Los plazos de revisión dependen de la disponibilidad de los revisores y de la complejidad del artículo, por lo que no son fijos. Te mantendremos informado de cualquier avance.</em></p>
          
          <div class="button-container">
            <a href="https://www.revistacienciasestudiantes.com/es/login" class="btn">VER ESTADO</a>
          </div>
        `
        : `
          ${minorMessage}
          
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

      return res.status(201).json({
        success: true,
        submissionId,
        driveFolderUrl: folder.webViewLink,
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

/**
 * Obtiene todos los envíos del usuario autenticado
 * Callable function para llamar desde el frontend
 */
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
        articleType: data.articleType   // ← NUEVO
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

/**
 * Verifica el estado detallado de un envío específico
 * Callable function para llamar desde el frontend
 */
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
        articleType: submission.articleType,           // ← NUEVO
        acknowledgments: submission.acknowledgments,   // ← NUEVO
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