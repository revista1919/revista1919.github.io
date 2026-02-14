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

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

/* ===================== CONFIG ===================== */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const IMGBB_API_KEY = defineSecret("IMGBB_API_KEY");
const GH_TOKEN = defineSecret("GH_TOKEN");

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
  'Instituciones Colaboradora': 'Partner Institution'
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
    repo: "revista1919.github.io",
    path: `${folder}/${fileName}`,
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
      repo: "revista1919.github.io",
      path: `${folder}/${fileName}`,
      branch: "main"
    });
    
    await octokit.repos.deleteFile({
      owner: "revista1919",
      repo: "revista1919.github.io",
      path: `${folder}/${fileName}`,
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

/* ===================== IMGBB UPLOAD ===================== */
// EN index.js - AÑADE ESTA FUNCIÓN
exports.uploadImageToImgBBCallable = onCall(
  { secrets: [IMGBB_API_KEY] },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes estar logueado');
    }

    try {
      await validateRole(auth.uid, "Director General");
    } catch (err) {
      throw new HttpsError('permission-denied', err.message);
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
      if (expiration) url.searchParams.set("expiration", String(expiration));

      const response = await fetch(url.toString(), {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      });

      const data = await response.json();

      if (!data.success) {
        throw new HttpsError('internal', 'Error al subir a ImgBB');
      }

      return {
        success: true,
        url: data.data.url,
        display_url: data.data.display_url,
        delete_url: data.data.delete_url
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
exports.manageArticles = onRequest(
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

      const { action, article, pdfBase64, id } = req.body;
      const db = admin.firestore();
      const ref = db.collection("articles");

      if (action === "add") {
        if (!article?.titulo) {
          return res.status(400).json({ error: "Datos de artículo incompletos" });
        }

        const docRef = await ref.add({
          ...article,
          pdfUrl: "",
          role: "Director General",
          createdBy: user.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (pdfBase64) {
          const slug = generateSlug(article.titulo);
          const fileName = `Article-${slug}-${docRef.id.slice(0, 5)}.pdf`;

          await uploadPDFToRepo(
            pdfBase64,
            fileName,
            `Add article: ${article.titulo}`,
            "Articles"
          );

          await docRef.update({
            pdfUrl: `${DOMAIN}/Articles/${fileName}`,
          });
        }

        return res.json({ success: true, id: docRef.id });
      }

      if (action === "edit") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const docRef = ref.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        await docRef.update({
          ...article,
          updatedBy: user.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (pdfBase64) {
          const old = doc.data();
          if (old.pdfUrl) {
            const oldFileName = old.pdfUrl.split("/").pop();
            await deletePDFFromRepo(
              oldFileName,
              `Delete old PDF for article: ${article.titulo || old.titulo}`,
              "Articles"
            );
          }

          const slug = generateSlug(article.titulo || old.titulo);
          const fileName = `Article-${slug}-${id.slice(0, 5)}.pdf`;

          await uploadPDFToRepo(
            pdfBase64,
            fileName,
            `Update article PDF: ${article.titulo || old.titulo}`,
            "Articles"
          );

          await docRef.update({
            pdfUrl: `${DOMAIN}/Articles/${fileName}`,
          });
        }

        return res.json({ success: true });
      }

      if (action === "delete") {
        if (!id) {
          return res.status(400).json({ error: "ID de artículo requerido" });
        }

        const docRef = ref.doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({ error: "Artículo no encontrado" });
        }

        const data = doc.data();
        if (data.pdfUrl) {
          const fileName = data.pdfUrl.split("/").pop();
          await deletePDFFromRepo(
            fileName,
            `Delete article PDF: ${data.titulo}`,
            "Articles"
          );
        }

        await docRef.delete();
        return res.json({ success: true });
      }

      return res.status(400).json({ error: "Acción inválida" });

    } catch (err) {
      console.error("Error en manageArticles:", err);
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message 
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