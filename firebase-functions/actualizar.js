// regenerateCertificatesWithDocId.js
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
const DRY_RUN = process.argv.includes('--dry-run');

// URL base para verificación (usando query params)
const VERIFICATION_URL_BASE = 'https://www.revistacienciasestudiantes.com/verificar/index.html?id=';

// ==================== CARGAR ARTICLES.JSON ====================
let articlesJson = [];
try {
  articlesJson = require('./articles.json');
  console.log(`📚 articles.json cargado: ${articlesJson.length} artículos`);
} catch (e) {
  console.warn('⚠️ No se pudo cargar articles.json, continuando sin él');
}

// ==================== OBTENER SECRETS ====================
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
  
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }
  
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

// ==================== FUNCIÓN: GENERAR PDF CON QR USANDO DOC ID ====================
async function generateCertificatePDF(data, lang = 'es', requestId = 'unknown', certificateDocId = null) {
  console.log(`[${requestId}] 🔧 Generando PDF...`);
  
  const isSpanish = lang === 'es';
  
  // USAR EL ID DEL DOCUMENTO COMO IDENTIFICADOR ÚNICO EN EL QR
  const verificationId = certificateDocId || data.certificateNumber;
  
  const CONFIG = {
    qr: { sizeCm: 2, offsetYCm: -0.5, offsetXCm: 0, errorCorrection: 'M', margin: 2 },
    // URL MODIFICADA: Ahora usa query params en lugar de path
    urlVerificacion: `${VERIFICATION_URL_BASE}${verificationId}`,
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
    
    console.log(`[${requestId}] ✅ QR insertado con URL: ${CONFIG.urlVerificacion}`);
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

// ==================== FUNCIÓN: REGENERAR CERTIFICADO ====================
async function regenerateCertificate(certDoc, drive, rootFolderId) {
  const certId = certDoc.id;
  const certData = certDoc.data();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Regenerando certificado: ${certId}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // 1. Obtener datos del submission relacionado
    const submissionId = certData.submissionId;
    const submissionRef = db.collection('submissions').doc(submissionId);
    const submissionDoc = await submissionRef.get();
    
    if (!submissionDoc.exists) {
      console.log('   ⚠️ Submission no encontrado, usando datos del certificado');
    }
    
    const submissionData = submissionDoc.exists ? submissionDoc.data() : {};
    
    // 2. Preparar datos para el PDF
    const authors = certData.authors || [];
    const title = certData.title || submissionData.title || 'Sin título';
    const lang = certData.language || submissionData.paperLanguage || 'es';
    const acceptanceDate = certData.acceptanceDate || new Date().toISOString().split('T')[0];
    
    const pdfData = {
      title,
      authors,
      submissionId,
      acceptanceDate,
      certificateNumber: certData.certificateNumber
    };
    
    // 3. Generar PDF con QR usando el ID del documento
    const requestId = `REGEN-${certId.substring(0, 8)}-${Date.now()}`;
    const pdfBuffer = await generateCertificatePDF(pdfData, lang, requestId, certId);
    
    // 4. Eliminar archivo anterior de Drive si existe
    if (certData.fileId) {
      try {
        await drive.files.delete({ fileId: certData.fileId });
        console.log(`   ✓ Archivo anterior eliminado: ${certData.fileId}`);
      } catch (deleteError) {
        console.log(`   ⚠️ No se pudo eliminar archivo anterior: ${deleteError.message}`);
      }
    }
    
    // 5. Crear carpeta para este certificado
    const submissionFolder = await findOrCreateFolder(
      drive,
      `CERT_${submissionId}`,
      rootFolderId
    );
    
    // 6. Subir nuevo PDF
    const fileName = `CERTIFICATE_${submissionId}_${Date.now()}.pdf`;
    const uploadedFile = await uploadPDFToDrive(
      drive,
      pdfBuffer,
      fileName,
      submissionFolder.id
    );
    
    console.log(`   🔗 URL: ${uploadedFile.webViewLink}`);
    
    // 7. Actualizar documento en colección certificates
    if (!DRY_RUN) {
      await certDoc.ref.update({
        fileId: uploadedFile.id,
        fileUrl: uploadedFile.webViewLink,
        fileName: uploadedFile.name,
        verificationId: certId, // El ID del documento es el identificador único
        verificationUrl: `${VERIFICATION_URL_BASE}${certId}`, // URL completa de verificación
        regeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        regeneratedBy: 'regenerate-script',
        qrContainsDocId: true,
        qrUsesQueryParams: true // Indicar que usa query params
      });
      
      console.log(`   ✅ Certificado actualizado con nuevo PDF`);
      console.log(`   🔗 URL de verificación: ${VERIFICATION_URL_BASE}${certId}`);
      
      // 8. Actualizar submission con nueva referencia
      if (submissionDoc.exists) {
        await submissionRef.update({
          certificateId: certId,
          certificateFileId: uploadedFile.id,
          certificateFileUrl: uploadedFile.webViewLink,
          certificateGenerated: true,
          certificateGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
          certificateVerificationUrl: `${VERIFICATION_URL_BASE}${certId}`
        });
        
        console.log(`   ✅ Submission actualizado`);
      }
    }
    
    return {
      success: true,
      certificateId: certId,
      fileId: uploadedFile.id,
      fileUrl: uploadedFile.webViewLink,
      verificationUrl: `${VERIFICATION_URL_BASE}${certId}`
    };
    
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

// ==================== FUNCIÓN PRINCIPAL ====================
async function main() {
  console.log('🚀 Iniciando regeneración de certificados con Doc ID en QR...');
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  console.log(`📋 Modo: ${DRY_RUN ? 'SIMULACIÓN (--dry-run)' : 'EJECUCIÓN REAL'}`);
  console.log(`🔗 URL base: ${VERIFICATION_URL_BASE}\n`);
  
  try {
    // Inicializar Drive
    const drive = await getDriveClient();
    console.log('✅ Drive inicializado\n');
    
    // Crear carpeta raíz
    const rootFolder = await findOrCreateFolder(drive, CERTIFICATES_ROOT_FOLDER_NAME);
    const rootFolderId = rootFolder.id;
    console.log(`📁 Carpeta raíz: ${rootFolderId}\n`);
    
    // Obtener todos los certificados de la colección pública
    const certSnapshot = await db.collection('certificates').get();
    console.log(`📦 Total certificados en colección: ${certSnapshot.docs.length}\n`);
    
    if (certSnapshot.empty) {
      console.log('❌ No hay certificados para regenerar');
      return;
    }
    
    // Procesar cada certificado
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const certDoc of certSnapshot.docs) {
      const result = await regenerateCertificate(certDoc, drive, rootFolderId);
      results.push({ certificateId: certDoc.id, ...result });
      
      if (result.success) {
        successCount++;
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
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📦 Total: ${certSnapshot.docs.length}`);
    
    if (results.length > 0) {
      console.log('\n📋 Detalle:');
      for (const result of results) {
        const emoji = result.success ? '✅' : '❌';
        if (result.success) {
          console.log(`   ${emoji} ${result.certificateId}`);
          console.log(`      🔗 ${result.verificationUrl}`);
        } else {
          console.log(`   ${emoji} ${result.certificateId}: ${result.reason}`);
        }
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