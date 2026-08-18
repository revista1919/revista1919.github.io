// fixAndRegenerateCertificates.js
"use strict";

const admin = require('firebase-admin');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { google } = require('googleapis');

// ==================== CONFIGURACIÓN ====================
const PROJECT_ID = 'usuarios-rnce';
const CERTIFICATES_ROOT_FOLDER_NAME = 'CERTIFICADOS_ACEPTACION';
const DRY_RUN = process.argv.includes('--dry-run'); // Modo simulación

// ==================== CARGAR ARTICLES.JSON ====================
let articlesJson = [];
try {
  articlesJson = require('./articles.json');
  console.log(`📚 articles.json cargado: ${articlesJson.length} artículos`);
} catch (e) {
  console.warn('⚠️ No se pudo cargar articles.json, continuando sin él');
}

// ==================== OBTENER SECRETS DE FIREBASE ====================
function getFirebaseSecret(secretName) {
  try {
    const secretValue = execSync(
      `firebase functions:secrets:access ${secretName} --project ${PROJECT_ID}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    
    if (secretValue && secretValue.length > 0) {
      return secretValue;
    }
  } catch (error) {
    console.log(`⚠️ No se pudo obtener ${secretName} via CLI, buscando archivo local...`);
  }
  
  const localSecretPath = path.join(__dirname, `.secrets.${secretName}`);
  if (fs.existsSync(localSecretPath)) {
    return fs.readFileSync(localSecretPath, 'utf-8').trim();
  }
  
  throw new Error(`No se pudo obtener el secret ${secretName}`);
}

// ==================== INICIALIZAR FIREBASE ====================
console.log('🔐 Obteniendo secrets de Firebase...\n');

let OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_REFRESH_TOKEN;

try {
  OAUTH2_CLIENT_ID = getFirebaseSecret('OAUTH2_CLIENT_ID');
  OAUTH2_CLIENT_SECRET = getFirebaseSecret('OAUTH2_CLIENT_SECRET');
  OAUTH2_REFRESH_TOKEN = getFirebaseSecret('OAUTH2_REFRESH_TOKEN');
  console.log('✅ Secrets obtenidos correctamente\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Service account cargado');
} catch {
  serviceAccount = null;
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
  });
} else {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();
console.log('✅ Firebase Admin inicializado\n');

// ==================== FUNCIONES DE UTILIDAD ====================
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[«»""'']/g, '')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(str1, str2) {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  
  if (!normalized1 || !normalized2) return 0;
  if (normalized1 === normalized2) return 1;
  
  // Verificar si uno contiene al otro
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }
  
  // Contar palabras comunes
  const words1 = new Set(normalized1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalized2.split(' ').filter(w => w.length > 2));
  
  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) commonWords++;
  }
  
  const avgLength = (words1.size + words2.size) / 2;
  return avgLength > 0 ? commonWords / avgLength : 0;
}

function normalizeDate(dateValue) {
  if (!dateValue) return null;
  
  try {
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    if (dateValue instanceof Date) {
      return dateValue;
    }
    return new Date(dateValue);
  } catch {
    return null;
  }
}

// ==================== FUNCIÓN: VERIFICAR SI ESTÁ PUBLICADO ====================
function isPublished(submissionData) {
  // Verificar múltiples indicadores de publicación
  const status = submissionData.status;
  const finalDecision = submissionData.finalDecision;
  const publicationReady = submissionData.publicationReady;
  
  // Solo considerar publicado si:
  // 1. status es 'published', O
  // 2. finalDecision es 'publish', O  
  // 3. publicationReady es true Y status es 'accepted'
  const isPublishedStatus = status === 'published';
  const isPublishDecision = finalDecision === 'publish' || finalDecision === 'accept';
  const isReadyForPublication = publicationReady === true;
  
  // Debe estar explícitamente publicado o listo para publicación
  return isPublishedStatus || (isPublishDecision && isReadyForPublication);
}

// ==================== FUNCIÓN: MATCHEO ROBUSTO ====================
function matchSubmissionWithArticle(submissionData, submissionId) {
  const articles = Array.isArray(articlesJson) ? articlesJson : [];
  
  if (articles.length === 0) {
    console.log('   ⚠️ No hay articles.json para matchear');
    return null;
  }
  
  const title = submissionData.title || 
                submissionData.currentMetadata?.title || 
                '';
  
  console.log(`   🔍 Buscando match para: "${title.substring(0, 80)}..."`);
  
  // 1. Intentar match por submissionId
  if (submissionId) {
    const idMatch = articles.find(a => 
      (a.submissionId || '').toLowerCase() === submissionId.toLowerCase()
    );
    if (idMatch) {
      console.log('   ✓ Match por submissionId');
      return { article: idMatch, confidence: 1.0, method: 'submissionId' };
    }
  }
  
  // 2. Match por título exacto
  const normalizedTitle = normalizeString(title);
  const titleMatch = articles.find(a => 
    normalizeString(a.titulo) === normalizedTitle
  );
  
  if (titleMatch) {
    console.log('   ✓ Match por título exacto');
    return { article: titleMatch, confidence: 1.0, method: 'title_exact' };
  }
  
  // 3. Match por similitud de título
  let bestMatch = null;
  let bestScore = 0;
  
  for (const article of articles) {
    const score = calculateSimilarity(title, article.titulo);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = article;
    }
  }
  
  if (bestMatch && bestScore > 0.6) {
    console.log(`   ⚠️ Match por similitud de título (${(bestScore * 100).toFixed(0)}%)`);
    return { article: bestMatch, confidence: bestScore, method: 'title_similarity' };
  }
  
  // 4. Match por autor
  const submissionAuthors = submissionData.authors || 
                           submissionData.currentMetadata?.authors || 
                           [];
  
  const authorEmails = submissionAuthors
    .map(a => a.email?.toLowerCase())
    .filter(Boolean);
  
  const authorNames = submissionAuthors
    .map(a => normalizeString(`${a.firstName} ${a.lastName}`))
    .filter(Boolean);
  
  for (const article of articles) {
    const articleAuthors = article.autores || [];
    
    // Match por email
    for (const articleAuthor of articleAuthors) {
      if (articleAuthor.email && authorEmails.includes(articleAuthor.email.toLowerCase())) {
        console.log('   ⚠️ Match por email de autor');
        return { article, confidence: 0.7, method: 'author_email' };
      }
    }
    
    // Match por nombre
    for (const articleAuthor of articleAuthors) {
      const articleAuthorName = normalizeString(articleAuthor.name || '');
      if (articleAuthorName && authorNames.some(n => n === articleAuthorName)) {
        console.log('   ⚠️ Match por nombre de autor');
        return { article, confidence: 0.7, method: 'author_name' };
      }
    }
  }
  
  console.log('   ✗ No se encontró match');
  return null;
}

// ==================== FUNCIÓN: EXTRAER AUTORES CORRECTOS ====================
function extractAuthorsFromArticle(article, submissionData) {
  // Si el artículo del JSON tiene autores bien formados, usarlos
  if (article.autores && Array.isArray(article.autores) && article.autores.length > 0) {
    return article.autores.map(a => ({
      firstName: a.name?.split(' ')[0] || '',
      lastName: a.name?.split(' ').slice(1).join(' ') || '',
      email: a.email || null,
      orcid: a.orcid || null,
      institution: a.institution || null,
      authorId: a.authorId || null,
      fullName: a.name || ''
    }));
  }
  
  // Fallback: usar los del submission pero corregir si son correos
  const submissionAuthors = submissionData.authors || 
                           submissionData.currentMetadata?.authors || 
                           [];
  
  return submissionAuthors.map(a => {
    const firstName = a.firstName || '';
    const lastName = a.lastName || '';
    
    // Si firstName parece ser un correo, intentar extraer el nombre del correo
    if (firstName.includes('@')) {
      const emailName = firstName.split('@')[0];
      const parts = emailName.split(/[._-]/);
      return {
        ...a,
        firstName: parts[0]?.charAt(0).toUpperCase() + parts[0]?.slice(1) || '',
        lastName: parts.slice(1).join(' '),
        fullName: parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
      };
    }
    
    return {
      ...a,
      fullName: `${firstName} ${lastName}`.trim()
    };
  });
}

// ==================== FUNCIÓN: OBTENER CLIENTE DE DRIVE ====================
async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    OAUTH2_CLIENT_ID,
    OAUTH2_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  
  oauth2Client.setCredentials({
    refresh_token: OAUTH2_REFRESH_TOKEN
  });
  
  await oauth2Client.getAccessToken();
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ==================== FUNCIÓN: ELIMINAR CERTIFICADO ANTERIOR ====================
async function deleteOldCertificate(submissionId, submissionData) {
  console.log(`   🗑️ Eliminando certificado anterior...`);
  
  try {
    // 1. Eliminar archivo de Drive si existe en el documento principal
    if (submissionData.certificate?.fileId) {
      try {
        const drive = await getDriveClient();
        await drive.files.delete({ fileId: submissionData.certificate.fileId });
        console.log(`   ✓ Archivo de Drive eliminado: ${submissionData.certificate.fileId}`);
      } catch (driveError) {
        console.log(`   ⚠️ No se pudo eliminar archivo de Drive: ${driveError.message}`);
      }
    }
    
    // 2. Eliminar campos de certificado del documento principal
    if (DRY_RUN) {
      console.log('   [DRY RUN] No se eliminaron campos de Firestore');
    } else {
      await db.collection('submissions').doc(submissionId).update({
        certificate: admin.firestore.FieldValue.delete(),
        certificateGenerated: admin.firestore.FieldValue.delete(),
        certificateGeneratedAt: admin.firestore.FieldValue.delete()
      });
      console.log('   ✓ Campos de certificado eliminados del documento principal');
    }
    
    // 3. Eliminar subcolección de certificados anterior
    if (!DRY_RUN) {
      const oldCertificates = await db
        .collection('submissions')
        .doc(submissionId)
        .collection('certificate')
        .get();
      
      const batch = db.batch();
      oldCertificates.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (oldCertificates.docs.length > 0) {
        await batch.commit();
        console.log(`   ✓ ${oldCertificates.docs.length} certificados antiguos eliminados de subcolección`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error eliminando certificado:`, error.message);
    return false;
  }
}

async function generateCertificatePDF(data, lang = 'es', requestId = 'unknown') {
  console.log(`[${requestId}] 🔧 Generando PDF...`);
  
  const isSpanish = lang === 'es';
  const CONFIG = {
    qr: { sizeCm: 2, offsetYCm: -0.5, offsetXCm: 0, errorCorrection: 'M', margin: 2 },
    urlVerificacion: `https://www.revistacienciasestudiantes.com/verificar/${data.certificateNumber}`,
    cabecera: { marginTopCm: 2.2, extraSpaceCm: 0.3, logoWidthCm: 3.2, tituloSize: 22, subtituloSize: 16 }
  };
  
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 0, left: 0, right: 0, bottom: 0 },
    autoFirstPage: true,
    bufferPages: true
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
  
  // Formatear autores - USANDO fullName si está disponible
  const authorsList = data.authors
    ?.map(a => a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || 'Author')
    .join(', ') || 'Authors';
  
  const formattedDate = new Date(data.acceptanceDate).toLocaleDateString(
    isSpanish ? 'es-ES' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
  
  // ==========================================
  // MARCO PERIMETRAL Y FONDO
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
  
  // Marca de agua
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
    // Silencioso
  }
  doc.restore();
  
  // ==========================================
  // MÁRGENES DE TRABAJO
  // ==========================================
  const marginX = cmToPoints(2.5);
  const marginY = cmToPoints(CONFIG.cabecera.marginTopCm);
  const contentWidth = pageWidth - (2 * marginX);
  
  // ==========================================
  // CABECERA INSTITUCIONAL
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
    }
  } catch(e) {
    // Placeholder
    doc.rect(marginX, currentY, logoWidth, logoWidth).strokeColor('#CCCCCC').lineWidth(1).stroke();
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
  // CUERPO DEL CERTIFICADO
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
  // PIE CON QR DE AUTENTICIDAD
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
      width: 500,
      color: { dark: '#003B5C', light: '#FFFFFF' }
    });
    
    const qrBuffer = Buffer.from(qrDataURL.split(',')[1], 'base64');
    const qrSize = cmToPoints(CONFIG.qr.sizeCm);
    const qrX = qrAreaX + (qrAreaWidth - qrSize) / 2 + cmToPoints(CONFIG.qr.offsetXCm);
    const qrY = qrAreaY + cmToPoints(CONFIG.qr.offsetYCm);
    
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
  } catch (qrError) {
    console.error(`[${requestId}] ❌ Error al insertar QR:`, qrError.message);
  }
  
  doc.end();
  const pdfBuffer = await pdfPromise;
  console.log(`[${requestId}] ✅ PDF generado: ${(pdfBuffer.length / 1024).toFixed(2)}KB`);
  
  return pdfBuffer;
}
// ==================== FUNCIÓN: SUBIR PDF A DRIVE ====================
async function uploadPDFToDrive(drive, pdfBuffer, fileName, folderId) {
  const { Readable } = require('stream');
  const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
  const readableStream = Readable.from(buffer);
  
  const response = await drive.files.create({
    resource: {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [folderId]
    },
    media: {
      mimeType: 'application/pdf',
      body: readableStream
    },
    fields: 'id, name, webViewLink'
  });
  
  return response.data;
}

// ==================== FUNCIÓN: ENCONTRAR O CREAR CARPETA ====================
async function findOrCreateFolder(drive, folderName, parentId = null) {
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  
  if (response.data.files.length > 0) {
    return response.data.files[0];
  }
  
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  
  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name, webViewLink'
  });
  
  return folder.data;
}

// ==================== FUNCIÓN: PROCESAR SUBMISSION ====================
async function processSubmission(doc, drive, rootFolderId) {
  const submissionData = doc.data();
  const submissionId = doc.id;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Procesando: ${submissionId}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // 1. VERIFICAR SI ESTÁ PUBLICADO (no solo aceptado)
    const isPublishedDoc = isPublished(submissionData);
    
    if (!isPublishedDoc) {
      console.log('   ⚠️ No está publicado, saltando...');
      return { success: false, reason: 'not_published' };
    }
    
    console.log('   ✓ Verificado como publicado');
    
    // 2. Verificar si es legacy
    const articleType = submissionData.articleType || 'normal';
    const isLegacy = articleType === 'legacy';
    
    console.log(`   Tipo de artículo: ${articleType}`);
    
    // 3. Para legacy, hacer matcheo con articles.json
    let matchedArticle = null;
    let matchInfo = null;
    
    if (isLegacy) {
      matchInfo = matchSubmissionWithArticle(submissionData, submissionId);
      matchedArticle = matchInfo?.article || null;
      
      if (!matchedArticle) {
        console.log('   ⚠️ Artículo legacy sin match en articles.json');
        // Verificar si tiene autores válidos en Firestore
        const hasValidAuthors = (submissionData.authors || []).some(a => 
          a.firstName && !a.firstName.includes('@')
        );
        
        if (!hasValidAuthors) {
          console.log('   ❌ No se puede generar certificado sin autores válidos');
          return { success: false, reason: 'no_valid_authors' };
        }
      }
    }
    
    // 4. Obtener metadatos finales
    const finalMetadata = submissionData.currentMetadata || submissionData;
    
    // 5. Determinar título
    let title;
    if (matchedArticle?.titulo) {
      title = matchedArticle.titulo;
      console.log(`   📝 Título desde JSON: "${title.substring(0, 60)}..."`);
    } else {
      title = finalMetadata.title || submissionData.title;
      console.log(`   📝 Título desde Firestore: "${title?.substring(0, 60)}..."`);
    }
    
    if (!title) {
      console.log('   ⚠️ Sin título, saltando...');
      return { success: false, reason: 'no_title' };
    }
    
    // 6. Determinar autores
    let authors;
    if (matchedArticle?.autores) {
      authors = extractAuthorsFromArticle(matchedArticle, submissionData);
      console.log(`   👥 Autores desde JSON (${authors.length}):`);
      authors.forEach(a => console.log(`      - ${a.fullName}`));
    } else {
      authors = (finalMetadata.authors || submissionData.authors || []).map(a => ({
        ...a,
        fullName: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim()
      }));
      console.log(`   👥 Autores desde Firestore (${authors.length}):`);
      authors.forEach(a => console.log(`      - ${a.fullName || a.email}`));
    }
    
    // 7. Determinar fecha de aceptación
    let acceptanceDate;
    
    // PRIORIDAD: Usar acceptedDate del JSON si existe
    if (matchedArticle?.acceptedDate) {
      acceptanceDate = matchedArticle.acceptedDate;
      console.log(`   📅 Fecha de aceptación desde JSON: ${acceptanceDate}`);
    } else if (submissionData.acceptedDate) {
      acceptanceDate = submissionData.acceptedDate;
      console.log(`   📅 Fecha de aceptación desde Firestore: ${acceptanceDate}`);
    } else if (submissionData.acceptedAt) {
      acceptanceDate = normalizeDate(submissionData.acceptedAt)?.toISOString().split('T')[0];
      console.log(`   📅 Fecha de aceptación desde acceptedAt: ${acceptanceDate}`);
    } else if (submissionData.decisionMadeAt) {
      acceptanceDate = normalizeDate(submissionData.decisionMadeAt)?.toISOString().split('T')[0];
      console.log(`   📅 Fecha de aceptación desde decisionMadeAt: ${acceptanceDate}`);
    } else {
      acceptanceDate = new Date().toISOString().split('T')[0];
      console.log(`   📅 Fecha de aceptación predeterminada: ${acceptanceDate}`);
    }
    
    // 8. Determinar idioma
    const lang = finalMetadata.paperLanguage || submissionData.paperLanguage || 'es';
    console.log(`   🗣️ Idioma: ${lang}`);
    
    // 9. Eliminar certificado anterior si existe
    if (submissionData.certificateGenerated === true || submissionData.certificate) {
      console.log('   🔄 Certificado anterior encontrado, eliminando...');
      await deleteOldCertificate(submissionId, submissionData);
    }
    
    // 10. Preparar datos del certificado
    const certificateData = {
      title,
      authors,
      submissionId,
      acceptanceDate,
      certificateNumber: `RNCE-${submissionId.substring(0, 8)}-${new Date().getFullYear()}`,
      matchInfo: matchInfo
    };
    
    // 11. Generar PDF
    const requestId = `CERT-${submissionId}-${Date.now()}`;
    const pdfBuffer = await generateCertificatePDF(certificateData, lang, requestId);
    
    // 12. Crear carpeta para este submission
    const submissionFolder = await findOrCreateFolder(
      drive,
      `CERT_${submissionId}`,
      rootFolderId
    );
    
    // 13. Subir PDF
    const fileName = `CERTIFICATE_${submissionId}_${Date.now()}.pdf`;
    const uploadedFile = await uploadPDFToDrive(
      drive,
      pdfBuffer,
      fileName,
      submissionFolder.id
    );
    
    console.log(`   🔗 URL: ${uploadedFile.webViewLink}`);
    
    // 14. Guardar en subcolección 'certificate'
    if (DRY_RUN) {
      console.log('   [DRY RUN] No se guardó en Firestore');
    } else {
      const certificateData = {
        fileId: uploadedFile.id,
        fileUrl: uploadedFile.webViewLink,
        fileName: uploadedFile.name,
        certificateNumber: certificateData.certificateNumber,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'fix-script',
        language: lang,
        acceptanceDate,
        title,
        submissionId,
        ...(matchInfo ? {
          matchedWithJson: true,
          matchMethod: matchInfo.method,
          matchConfidence: matchInfo.confidence
        } : {
          matchedWithJson: false
        }),
        authors: authors.map(a => ({
          fullName: a.fullName,
          email: a.email || null,
          orcid: a.orcid || null
        }))
      };
      
      // Guardar en subcolección
      await db
        .collection('submissions')
        .doc(submissionId)
        .collection('certificate')
        .add(certificateData);
      
      console.log('   ✅ Certificado guardado en subcolección');
    }
    
    return {
      success: true,
      certificateId: uploadedFile.id,
      certificateUrl: uploadedFile.webViewLink,
      certificateNumber: certificateData.certificateNumber,
      matchMethod: matchInfo?.method || 'none',
      authors: authors.map(a => a.fullName)
    };
    
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

// ==================== FUNCIÓN PRINCIPAL ====================
async function main() {
  console.log('🚀 Iniciando script de corrección y regeneración de certificados...');
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  console.log(`📋 Modo: ${DRY_RUN ? 'SIMULACIÓN (--dry-run)' : 'EJECUCIÓN REAL'}\n`);
  
  try {
    // Inicializar Drive
    const drive = await getDriveClient();
    console.log('✅ Drive inicializado\n');
    
    // Crear carpeta raíz
    const rootFolder = await findOrCreateFolder(drive, CERTIFICATES_ROOT_FOLDER_NAME);
    const rootFolderId = rootFolder.id;
    console.log(`📁 Carpeta raíz: ${rootFolderId}\n`);
    
    // Obtener todos los submissions
    const snapshot = await db.collection('submissions').get();
    console.log(`📦 Total submissions: ${snapshot.docs.length}\n`);
    
    // Filtrar solo los publicados
    const publishedSubmissions = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (isPublished(data)) {
        publishedSubmissions.push(doc);
      }
    }
    
    console.log(`📊 Submissions publicados: ${publishedSubmissions.length}\n`);
    
    // Procesar todos los submissions publicados
    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const doc of publishedSubmissions) {
      const result = await processSubmission(doc, drive, rootFolderId);
      results.push({ submissionId: doc.id, ...result });
      
      if (result.success) {
        successCount++;
      } else if (result.reason === 'no_title' || result.reason === 'no_valid_authors') {
        skipCount++;
      } else {
        errorCount++;
      }
      
      // Pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Resumen final
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 PROCESO COMPLETADO');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`⏭️ Saltados: ${skipCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📦 Total: ${publishedSubmissions.length}`);
    
    if (results.length > 0) {
      console.log('\n📋 Detalle:');
      for (const result of results) {
        const emoji = result.success ? '✅' : (result.reason === 'no_title' || result.reason === 'no_valid_authors' ? '⏭️' : '❌');
        const authors = result.authors ? ` - Autores: ${result.authors.join(', ')}` : '';
        console.log(`   ${emoji} ${result.submissionId}: ${result.success ? `Éxito (${result.matchMethod || 'sin match'})${authors}` : result.reason}`);
      }
    }
    
    console.log(`\n⏰ Fin: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    throw error;
  }
}

// ==================== EJECUTAR ====================
main()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });