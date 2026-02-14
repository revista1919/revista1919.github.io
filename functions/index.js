"use strict";

/* ===================== IMPORTS ===================== */
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { GoogleGenAI } = require("@google/genai");
const { Octokit } = require("@octokit/rest");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const FormData = require("form-data");
const fetch = require("node-fetch");

/* ===================== CONFIG ===================== */
setGlobalOptions({ maxInstances: 10 });
admin.initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const IMGBB_API_KEY = defineSecret("IMGBB_API_KEY");
const GH_TOKEN = defineSecret("GH_TOKEN");
const GOOGLE_SERVICE_ACCOUNT_EMAIL = defineSecret("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const GOOGLE_PRIVATE_KEY = defineSecret("GOOGLE_PRIVATE_KEY");

const DOMAIN = "https://www.revistacienciasestudiantes.com";
const ALLOWED_ORIGINS = [
  DOMAIN,
  "https://revistacienciasestudiantes.com", // Sin www
  "http://localhost:3000", // Para desarrollo local
  "http://localhost:5000" // Para emuladores de Firebase
];
const USERS_SHEET_ID = "1FIP4yMTNYtRYWiPwovWGPiWxQZ8wssko8u0-NkZOido";
const USERS_SHEET_NAME = "Hoja 1";

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
function applyCors(req, res) {
  const origin = req.headers.origin;
  
  // Verificar si el origen está permitido
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    // Por defecto, permitir solo el dominio principal
    res.set("Access-Control-Allow-Origin", DOMAIN);
  }
  
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Max-Age", "3600");
  
  // Para preflight requests
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

// Middleware para verificar origen
function validateOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // Permitir si es del dominio permitido
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  
  // Verificar referer como fallback
  if (referer) {
    for (const allowed of ALLOWED_ORIGINS) {
      if (referer.startsWith(allowed)) {
        return true;
      }
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
  const user = await admin.auth().getUser(uid);
  const roles = user.customClaims?.roles || [];
  if (!roles.includes(requiredRole)) throw new Error("Insufficient role");
  return true;
}

/* ===================== GITHUB HELPERS ===================== */
function getOctokit() { return new Octokit({ auth: GH_TOKEN.value() }); }

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
async function callGemini(prompt, temperature = 0) {
  const apiKey = GEMINI_API_KEY.value();
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, topP: 0.8, maxOutputTokens: 4096 }
  });

  let text = result.response.text()?.trim() || "";
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  return text;
}

/* ===================== PROMPTS ===================== */
async function translateText(text, source, target) {
  const prompt = `You are a faithful translator for an academic journal.

Task:
Translate the following text from ${source} to ${target}.

Rules:
- Translate faithfully and accurately.
- Do not add, remove, or reinterpret meaning.
- Do not add quotes.
- Do not add explanations or extra text.
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
- Do NOT summarize, add, remove, or alter any content or meaning.
- Translate faithfully and accurately.
- Do NOT translate article titles; preserve them exactly as written.
- Preserve ALL HTML structure exactly:
  - tags
  - attributes
  - classes
  - styles
  - scripts
- Only translate user-facing text nodes and user-facing attribute values (e.g. alt, title, placeholder, meta content).
- Use the official journal name according to the target language.
- For links to individual news pages in <a href> attributes (e.g. "/news/slug.html"):
  - If the target language is English, append ".EN" before ".html" → "/news/slug.EN.html"
  - Do NOT modify other links.
- Preserve base64-encoded images (data:image/*;base64,...) exactly as they are.
- Do NOT attempt to translate or modify base64 content.

Output:
- Output ONLY the translated HTML fragment.
- Do NOT wrap in markdown.
- Do NOT add explanations.

HTML code fragment to translate:
${html}
`;

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
exports.uploadImageToImgBB = onRequest({ secrets: [IMGBB_API_KEY] }, async (req, res) => {
  // Aplicar CORS
  if (applyCors(req, res)) return;
  
  // Validar origen
  if (!validateOrigin(req)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) return res.status(401).json({ error: "Unauthorized" });

  let user;
  try { user = await admin.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: "Invalid token" }); }

  try {
    const { imageBase64, name, expiration } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

    const form = new FormData();
    form.append("image", imageBase64);
    if (name) form.append("name", name);

    const url = new URL("https://api.imgbb.com/1/upload");
    url.searchParams.set("key", IMGBB_API_KEY.value());
    if (expiration) url.searchParams.set("expiration", String(expiration));

    const response = await fetch(url.toString(), { method: "POST", body: form });
    const data = await response.json();

    if (!data.success) return res.status(400).json({ error: "ImgBB upload failed", details: data });

    return res.json({
      success: true,
      url: data.data.url,
      display_url: data.data.display_url,
      url_viewer: data.data.url_viewer,
      delete_url: data.data.delete_url
    });
  } catch (err) {
    console.error("Error in uploadImageToImgBB:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
});

/* ===================== UPLOAD NEWS ===================== */
exports.uploadNews = onRequest(
  { secrets: [GEMINI_API_KEY] },
  async (req, res) => {
    // Aplicar CORS
    if (applyCors(req, res)) return;
    
    // Validar origen
    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken)
      return res.status(401).json({ error: "Unauthorized" });

    let user;
    try {
      user = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      await validateRole(user.uid, "Director General");
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    try {
      const { title, body, photo, language = "es" } = req.body;
      if (!title || !body)
        return res.status(400).json({ error: "Missing data" });

      const source = language.toLowerCase();
      const target = source === "es" ? "en" : "es";

      const titleSource = sanitizeInput(title);
      const bodySource = base64DecodeUnicode(body) || sanitizeInput(body);

      const titleTarget = await translateText(
        titleSource,
        source,
        target,
      );

      const bodyTarget = await translateHtmlFragmentWithSplit(
        bodySource,
        source,
        target,
      );

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
      };

      await newsRef.add(docData);

      return res.json({
        success: true,
        title_source: titleSource,
        title_target: titleTarget,
        body_target: bodyTarget,
      });
    } catch (err) {
      console.error("Error in uploadNews:", err);
      return res.status(500).json({
        error: "Internal server error",
        message: err.message,
      });
    }
  }
);

/* ===================== MANAGE ARTICLES ===================== */
exports.manageArticles = onRequest(
  { secrets: [GH_TOKEN] },
  async (req, res) => {
    // Aplicar CORS
    if (applyCors(req, res)) return;
    
    // Validar origen
    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const user = await admin.auth().verifyIdToken(token);
    await validateRole(user.uid, "Director General");

    const { action, article, pdfBase64, id } = req.body;
    const db = admin.firestore();
    const ref = db.collection("articles");

    if (action === "add") {
      const docRef = await ref.add({
        ...article,
        pdfUrl: "",
        role: "Director General",
      });

      if (pdfBase64) {
        const slug = generateSlug(article.titulo);
        const fileName = `Article-${slug}-${docRef.id.slice(0, 5)}.pdf`;

        await uploadPDFToRepo(
          pdfBase64,
          fileName,
          "Add article PDF",
          "Articles",
        );

        await docRef.update({
          pdfUrl: `${DOMAIN}/Articles/${fileName}`,
        });
      }

      return res.json({ success: true });
    }

    if (action === "edit") {
      const docRef = ref.doc(id);
      const doc = await docRef.get();

      if (!doc.exists)
        return res.status(404).json({ error: "Not found" });

      await docRef.update(article);

      if (pdfBase64) {
        const old = doc.data();
        if (old.pdfUrl) {
          await deletePDFFromRepo(
            old.pdfUrl.split("/").pop(),
            "Delete old PDF",
            "Articles",
          );
        }

        const slug = generateSlug(article.titulo);
        const fileName = `Article-${slug}-${id.slice(0, 5)}.pdf`;

        await uploadPDFToRepo(
          pdfBase64,
          fileName,
          "Update article PDF",
          "Articles",
        );

        await docRef.update({
          pdfUrl: `${DOMAIN}/Articles/${fileName}`,
        });
      }

      return res.json({ success: true });
    }

    if (action === "delete") {
      const docRef = ref.doc(id);
      const doc = await docRef.get();

      if (!doc.exists)
        return res.status(404).json({ error: "Not found" });

      const data = doc.data();
      if (data.pdfUrl) {
        await deletePDFFromRepo(
          data.pdfUrl.split("/").pop(),
          "Delete article PDF",
          "Articles",
        );
      }

      await docRef.delete();
      return res.json({ success: true });
    }

    res.status(400).json({ error: "Invalid action" });
  },
);

/* ===================== MANAGE VOLUMES ===================== */
exports.manageVolumes = onRequest(
  { secrets: [GH_TOKEN] },
  async (req, res) => {
    // Aplicar CORS
    if (applyCors(req, res)) return;
    
    // Validar origen
    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let user;
    try {
      user = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      await validateRole(user.uid, "Director General");
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    const { action, volume, pdfBase64, id } = req.body;
    if (!action) {
      return res.status(400).json({ error: "Missing action" });
    }

    const db = admin.firestore();
    const ref = db.collection("volumes");

    if (action === "add") {
      if (!volume?.titulo) {
        return res.status(400).json({ error: "Missing volume data" });
      }

      const docRef = await ref.add({
        ...volume,
        pdf: "",
        role: "Director General",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (pdfBase64) {
        const slug = generateSlug(volume.titulo);
        const fileName = `Volume-${slug}-${docRef.id.slice(0, 5)}.pdf`;

        await uploadPDFToRepo(
          pdfBase64,
          fileName,
          "Add volume PDF",
          "Volumes",
        );

        await docRef.update({
          pdf: `${DOMAIN}/Volumes/${fileName}`,
        });
      }

      return res.json({ success: true });
    }

    if (action === "edit") {
      if (!id) {
        return res.status(400).json({ error: "Missing volume id" });
      }

      const docSnap = await ref.doc(id).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Volume not found" });
      }

      await ref.doc(id).update({
        ...volume,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (pdfBase64) {
        const oldData = docSnap.data();

        if (oldData.pdf) {
          const oldFileName = oldData.pdf.split("/").pop();
          await deletePDFFromRepo(
            oldFileName,
            "Delete old volume PDF",
            "Volumes",
          );
        }

        const slug = generateSlug(volume.titulo || oldData.titulo);
        const fileName = `Volume-${slug}-${id.slice(0, 5)}.pdf`;

        await uploadPDFToRepo(
          pdfBase64,
          fileName,
          "Update volume PDF",
          "Volumes",
        );

        await ref.doc(id).update({
          pdf: `${DOMAIN}/Volumes/${fileName}`,
        });
      }

      return res.json({ success: true });
    }

    if (action === "delete") {
      if (!id) {
        return res.status(400).json({ error: "Missing volume id" });
      }

      const docSnap = await ref.doc(id).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Volume not found" });
      }

      const data = docSnap.data();

      if (data.pdf) {
        const fileName = data.pdf.split("/").pop();
        await deletePDFFromRepo(
          fileName,
          "Delete volume PDF",
          "Volumes",
        );
      }

      await ref.doc(id).delete();

      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Invalid action" });
  },
);

/* ===================== TRIGGER REBUILD ===================== */
exports.triggerRebuild = onRequest(
  { secrets: [GH_TOKEN] },
  async (req, res) => {
    // Aplicar CORS
    if (applyCors(req, res)) return;
    
    // Validar origen
    if (!validateOrigin(req)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let user;
    try {
      user = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      await validateRole(user.uid, "Director General");
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    const octokit = getOctokit();

    await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
      owner: "revista1919",
      repo: "revista1919.github.io",
      event_type: "rebuild",
    });

    return res.json({ success: true });
  }
);

/* ===================== UPDATE USER ROLE (CALLABLE FUNCTION) ===================== */
exports.updateUserRole = onCall(async (request) => {
  const { auth } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes estar logueado');

  await validateRole(auth.uid, "Director General");

  const { targetUid, newRoles } = request.data;
  if (!targetUid || !Array.isArray(newRoles)) throw new HttpsError('invalid-argument', 'Datos inválidos');

  // Log de quién cambió qué
  console.log(`Director ${auth.uid} cambió roles de ${targetUid} a:`, newRoles);

  await admin.auth().setCustomUserClaims(targetUid, { roles: newRoles });
  await admin.firestore().collection('users').doc(targetUid).update({
    roles: newRoles,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

/* ===================== SYNC USERS TO SHEET ===================== */
async function syncUsersToSheet() {
  const snapshot = await admin.firestore().collection("users").get();
  const rows = [];

  for (const docSnap of snapshot.docs) {
    const d = docSnap.data();

    const descEs = d.description?.es || '';
    const descEn = d.description?.en || descEs;
    const interestsEs = d.interests?.es || '';
    const interestsEn = d.interests?.en || interestsEs;

    const rolesEs = d.roles.join(';');
    const rolesEn = d.roles.map(r => ES_TO_EN[r] || r).join(';');

    rows.push([
      d.displayName || '',
      descEs, interestsEs, rolesEs,
      d.publicEmail || '',
      d.imageUrl || '',
      descEn, interestsEn, rolesEn
    ]);
  }

  const doc = new GoogleSpreadsheet(USERS_SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL.value(),
    private_key: GOOGLE_PRIVATE_KEY.value().replace(/\\n/g, "\n")
  });
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[USERS_SHEET_NAME];
  await sheet.clear();
  await sheet.addRows(rows);
}

exports.onUserCreate = onDocumentCreated("users/{uid}", async () => { await syncUsersToSheet(); });
exports.onUserUpdate = onDocumentUpdated("users/{uid}", async () => { await syncUsersToSheet(); });