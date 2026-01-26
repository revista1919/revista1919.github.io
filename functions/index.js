"use strict";

/* ===================== IMPORTS ===================== */

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Octokit } = require("@octokit/rest");
const Papa = require("papaparse");

/* ===================== CONFIG ===================== */

setGlobalOptions({ maxInstances: 10 });
admin.initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GH_TOKEN = defineSecret("GH_TOKEN");

/* ⚠️ Ajusta si cambias dominio */
const DOMAIN = "https://www.revistacienciasestudiantes.com";

/* CSV de usuarios (roles) */
const USERS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv";

/* ===================== UTILIDADES GENERALES ===================== */

function base64DecodeUnicode(str) {
  try {
    if (!str) return "";
    return Buffer.from(str, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function sanitizeInput(input) {
  if (!input) return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .trim();
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ===================== VALIDACIÓN DE ROL ===================== */

async function validateRole(email, requiredRole) {
  const res = await fetch(USERS_CSV);
  const csv = await res.text();

  const parsed = Papa.parse(csv, { header: true }).data;

  const user = parsed.find(
    (u) => u.Correo?.toLowerCase() === email.toLowerCase(),
  );

  if (!user) throw new Error("User not found in CSV");

  const roles =
    user["Rol en la Revista"]
      ?.split(";")
      .map((r) => r.trim()) || [];

  if (!roles.includes(requiredRole)) {
    throw new Error("Insufficient role");
  }

  return true;
}

/* ===================== GITHUB PDF HELPERS ===================== */

function getOctokit() {
  return new Octokit({
    auth: process.env.GH_TOKEN,
  });
}

async function uploadPDFToRepo(base64, fileName, message, repo) {
  const octokit = getOctokit();
  const path = fileName;

  const existing = await octokit
    .request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: "revista1919",
      repo,
      path,
    })
    .then((r) => r.data)
    .catch(() => null);

  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: "revista1919",
    repo,
    path,
    message,
    content: base64,
    sha: existing?.sha,
  });
}

async function deletePDFFromRepo(fileName, message, repo) {
  const octokit = getOctokit();
  const path = fileName;

  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: "revista1919",
        repo,
        path,
      },
    );

    await octokit.request(
      "DELETE /repos/{owner}/{repo}/contents/{path}",
      {
        owner: "revista1919",
        repo,
        path,
        message,
        sha: data.sha,
      },
    );
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

/* ===================== GEMINI CORE ===================== */

async function callGemini(prompt, temperature, apiKey) {
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      topP: 0.8,
      maxOutputTokens: 4096,
    },
  });

  let text = result.response.text().trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:html)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  return text;
}

/* ===================== PROMPTS (CONSERVADOS) ===================== */

/* ===================== PROMPTS (ADAPTADOS) ===================== */

async function translateText(text, source, target, apiKey) {
  const prompt = `You are a faithful translator for an academic journal.

The journal's official English name is "The National Review of Sciences for Students" (do not translate it as "magazine"; it is an academic review/journal).
The official Spanish name is "La Revista Nacional de Ciencias para Estudiantes".

It is an academic journal initiated in Chile that aspires to become a reference in the publication of primarily high school students at local and global levels.

Task:
Translate the following news title from ${source} to ${target}.

Rules:
- Translate faithfully and accurately.
- Do not add, remove, or reinterpret meaning.
- Do not add quotes.
- Do not add explanations or extra text.
- Output ONLY the translated title.

Title to translate:
"${text}"`;

  return callGemini(prompt, 0, apiKey);
}

async function translateHtmlFragment(html, source, target, apiKey) {
  const prompt = `
You are a faithful translator for an academic journal.

The journal's official English name is "The National Review of Sciences for Students" (do not translate it as "magazine"; it is an academic review/journal).
The official Spanish name is "La Revista Nacional de Ciencias para Estudiantes".

It is an academic journal initiated in Chile that aspires to become a reference in the publication of primarily high school students at local and global levels.

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

  return callGemini(prompt, 0, apiKey);
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

async function translateHtmlFragmentWithSplit(html, source, target, apiKey) {
  if (html.length < 3000) {
    return translateHtmlFragment(html, source, target, apiKey);
  }

  const fragments = splitHtmlContent(html);
  const translated = [];

  for (const frag of fragments) {
    translated.push(
      await translateHtmlFragment(frag, source, target, apiKey),
    );
  }

  return translated.join("");
}

/* ===================== UPLOAD NEWS (EXISTENTE) ===================== */

exports.uploadNews = onRequest(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (req, res) => {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken)
      return res.status(401).json({ error: "Unauthorized" });

    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { title, body, language = "es" } = req.body;
    if (!title || !body)
      return res.status(400).json({ error: "Missing data" });

    const apiKey = GEMINI_API_KEY.value();

    const source = language.toLowerCase();
    const target = source === "es" ? "en" : "es";

    const titleSource = sanitizeInput(title);
    const bodySource =
      base64DecodeUnicode(body) || sanitizeInput(body);

    const titleTarget = await translateText(
      titleSource,
      source,
      target,
      apiKey,
    );

    const bodyTarget = await translateHtmlFragmentWithSplit(
      bodySource,
      source,
      target,
      apiKey,
    );

    res.json({
      success: true,
      title_source: titleSource,
      title_target: titleTarget,
      body_target: bodyTarget,
    });
  },
);

/* ===================== MANAGE ARTICLES ===================== */

exports.manageArticles = onRequest(
  { secrets: [GH_TOKEN], cors: true },
  async (req, res) => {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    let user;
    try {
      user = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      await validateRole(user.email, "Director General");
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

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
      const doc = await ref.doc(id).get();
      if (!doc.exists)
        return res.status(404).json({ error: "Not found" });

      await ref.doc(id).update(article);

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

        await ref.doc(id).update({
          pdfUrl: `${DOMAIN}/Articles/${fileName}`,
        });
      }

      return res.json({ success: true });
    }

    if (action === "delete") {
      const doc = await ref.doc(id).get();
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

      await ref.doc(id).delete();
      return res.json({ success: true });
    }

    res.status(400).json({ error: "Invalid action" });
  },
);

/* ===================== MANAGE VOLUMES ===================== */

exports.manageVolumes = onRequest(
  { secrets: [GH_TOKEN], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    /* ---------- Auth ---------- */
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

    /* ---------- Rol ---------- */
    try {
      await validateRole(user.email, "Director General");
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    /* ---------- Data ---------- */
    const { action, volume, pdfBase64, id } = req.body;
    if (!action) {
      return res.status(400).json({ error: "Missing action" });
    }

    const db = admin.firestore();
    const ref = db.collection("volumes");

    /* ===================== ADD ===================== */
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

    /* ===================== EDIT ===================== */
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

    /* ===================== DELETE ===================== */
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

    /* ===================== FALLBACK ===================== */
    return res.status(400).json({ error: "Invalid action" });
  },
);