/* ================================================================
 * SCRIPT: Generar Certificados para Artículos Aceptados y Publicados
 * Descripción: Procesa artículos legacy y normales que estén en 
 *              articles.json (publicados) y genera certificados
 *              idénticos al diseño original
 * ================================================================ */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Cargar articles.json
const articlesJson = require('./articles.json');

// Dependencias para generación de PDF
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/* ===================== FUNCIÓN: OBTENER CLIENTE DE DRIVE ===================== */
async function getDriveClient(requestId = 'unknown') {
  console.log(`[${requestId}] 🔑 Obteniendo cliente de Google Drive...`);
  
  try {
    // Obtener el token de acceso usando la cuenta de servicio
    const accessToken = await serviceAccount.getAccessToken();
    
    const { google } = require('googleapis');
    const { OAuth2Client } = require('google-auth-library');
    
    const oauth2Client = new OAuth2Client(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/drive']
    );
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log(`[${requestId}] ✅ Cliente de Drive inicializado`);
    return { drive, oauth2Client };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error obteniendo cliente de Drive:`, error.message);
    throw error;
  }
}

/* ===================== FUNCIÓN: CREAR CARPETA EN DRIVE ===================== */
async function createDriveFolder(drive, folderName, parentFolderId = null) {
  try {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }
    
    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, name, webViewLink'
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error creando carpeta en Drive:`, error.message);
    throw error;
  }
}

/* ===================== FUNCIÓN: SUBIR ARCHIVO A DRIVE ===================== */
async function uploadToDrive(drive, base64Data, fileName, folderId) {
  try {
    const response = await drive.files.create({
      resource: {
        name: fileName,
        mimeType: 'application/pdf',
        parents: [folderId]
      },
      media: {
        mimeType: 'application/pdf',
        body: Buffer.from(base64Data, 'base64')
      },
      fields: 'id, name, webViewLink, webContentLink'
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error subiendo archivo a Drive:`, error.message);
    throw error;
  }
}

/* ===================== FUNCIÓN: NORMALIZAR FECHA ===================== */
function normalizeDate(dateValue) {
  if (!dateValue) return null;
  
  try {
    // Si es Timestamp de Firebase
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Si es string en formato Firestore
    if (typeof dateValue === 'string' && dateValue.includes('UTC')) {
      return new Date(dateValue);
    }
    
    // Si es string en formato ISO
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    
    // Si ya es Date
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    return null;
  } catch (error) {
    console.error(`Error normalizando fecha:`, error.message);
    return null;
  }
}

/* ===================== FUNCIÓN: MATCHEAR ARTÍCULO CON JSON ===================== */
function matchArticleWithJson(submissionData, articlesList) {
  const submissionId = submissionData.submissionId || '';
  const title = submissionData.title || (submissionData.currentMetadata?.title) || '';
  const authors = submissionData.authors || (submissionData.currentMetadata?.authors) || [];
  
  // Extraer nombres de autores
  const authorNames = authors.map(a => {
    const firstName = a.firstName || '';
    const lastName = a.lastName || '';
    return `${firstName} ${lastName}`.trim().toLowerCase();
  }).filter(Boolean);
  
  // 1. Primero intentar matchear por submissionId exacto
  if (submissionId) {
    const exactMatch = articlesList.find(article => 
      (article.submissionId || '').toLowerCase() === submissionId.toLowerCase()
    );
    if (exactMatch) {
      console.log(`   ✓ Match por submissionId: ${submissionId}`);
      return exactMatch;
    }
  }
  
  // 2. Matchear por título exacto (normalizado)
  const normalizedTitle = title.toLowerCase().trim()
    .replace(/[«»""'']/g, '')
    .replace(/[\s]+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const titleMatch = articlesList.find(article => {
    const articleTitle = (article.titulo || '').toLowerCase().trim()
      .replace(/[«»""'']/g, '')
      .replace(/[\s]+/g, ' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return articleTitle === normalizedTitle;
  });
  
  if (titleMatch) {
    console.log(`   ✓ Match por título: "${title.substring(0, 50)}..."`);
    return titleMatch;
  }
  
  // 3. Matchear por título parcial (similitud)
  const titleWords = normalizedTitle.split(' ').filter(w => w.length > 3);
  const partialMatch = articlesList.find(article => {
    const articleTitle = (article.titulo || '').toLowerCase().trim()
      .replace(/[«»""'']/g, '')
      .replace(/[\s]+/g, ' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const matchCount = titleWords.filter(word => articleTitle.includes(word)).length;
    return matchCount >= Math.min(3, titleWords.length * 0.6);
  });
  
  if (partialMatch) {
    console.log(`   ⚠ Match parcial por título: "${title.substring(0, 50)}..."`);
    return partialMatch;
  }
  
  // 4. Matchear por primer autor
  if (authorNames.length > 0) {
    const authorMatch = articlesList.find(article => {
      const articleAuthors = article.authors || [];
      return articleAuthors.some(a => {
        const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        return authorNames.some(name => name === fullName);
      });
    });
    
    if (authorMatch) {
      console.log(`   ⚠ Match por autor: ${authorNames[0]}`);
      return authorMatch;
    }
  }
  
  console.log(`   ✗ No se encontró match para: "${title.substring(0, 50)}..."`);
  return null;
}

/* ===================== FUNCIÓN: GENERAR PDF CON PDFKIT (EXACTA) ===================== */
async function generateCertificatePDF(data, lang = 'es', requestId = 'unknown') {
  console.log(`[${requestId}] 🔧 Generando PDF con PDFKit...`);
  
  try {
    const isSpanish = lang === 'es';
    
    // Configuración del certificado (basada en el diseño original)
    const CONFIG = {
      qr: {
        sizeCm: 2,
        offsetYCm: -0.5,
        offsetXCm: 0,
        errorCorrection: 'M',
        margin: 2,
        debug: false
      },
      urlVerificacion: `https://www.revistacienciasestudiantes.com/verificar/${data.certificateNumber}`,
      cabecera: {
        marginTopCm: 2.2,
        extraSpaceCm: 0.3,
        logoWidthCm: 3.2,
        tituloSize: 22,
        subtituloSize: 16,
      }
    };
    
    // Inicializar documento A4 apaisado sin márgenes automáticos
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: true,
      bufferPages: true
    });
    
    // Capturar chunks del PDF
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    
    // Promesa para esperar a que termine
    const pdfPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    
    const pageWidth = doc.page.width;   // A4 Landscape: 841.89 pts
    const pageHeight = doc.page.height; // A4 Landscape: 595.28 pts
    
    // Definición de colores
    const journalBlue = '#003B5C';
    const journalOrange = '#E86125';
    const lightGray = '#FBFBFC';
    const textGray = '#64748B';
    const textDark = '#333333';
    const textSlate = '#475569';
    
    // Funciones auxiliares
    function mmToPoints(mm) {
      return mm * 2.83465;
    }
    
    function cmToPoints(cm) {
      return cm * 28.3465;
    }
    
    // Configuración de fuentes nativas
    const fontSans = 'Helvetica';
    const fontSansBold = 'Helvetica-Bold';
    const fontSansItalic = 'Helvetica-Oblique';
    const fontSerif = 'Times-Roman';
    const fontSerifBold = 'Times-Bold';
    const fontSerifItalic = 'Times-Italic';
    const fontSerifSemiBold = 'Times-Bold';
    
    console.log(`[${requestId}] ✓ Usando fuentes nativas de PDFKit`);
    
    // Textos según idioma
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
    
    // Formatear autores
    const authorsList = data.authors
      ?.map(a => {
        const firstName = a.firstName || '';
        const lastName = a.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || a.email || 'Author';
      })
      .join(', ') || 'Authors';
    
    // Formatear fecha de aceptación
    const formattedDate = new Date(data.acceptanceDate).toLocaleDateString(
      isSpanish ? 'es-ES' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
    
    // ==========================================
    // MARCO PERIMETRAL Y FONDO
    // ==========================================
    // Fondo general sutil
    doc.rect(0, 0, pageWidth, pageHeight).fill(lightGray);
    
    // Borde azul principal
    const borderOffset1 = cmToPoints(1.2);
    doc.lineWidth(4).strokeColor(journalBlue);
    doc.rect(borderOffset1, borderOffset1, 
             pageWidth - 2 * borderOffset1, 
             pageHeight - 2 * borderOffset1).stroke();
    
    // Borde naranja fino interior
    const borderOffset2 = cmToPoints(1.4);
    doc.lineWidth(1).strokeColor(journalOrange);
    doc.rect(borderOffset2, borderOffset2, 
             pageWidth - 2 * borderOffset2, 
             pageHeight - 2 * borderOffset2).stroke();
    
    // Acentos geométricos
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
    
    // Marca de agua (si es posible cargar el logo)
    const watermarkWidth = cmToPoints(12);
    doc.save();
    doc.opacity(0.03);
    try {
      const logoUrl = isSpanish ? 'https://www.revistacienciasestudiantes.com/logo.png' : 'https://www.revistacienciasestudiantes.com/logoEN.png';
      const response = await fetch(logoUrl);
      if (response.ok) {
        const logoBuffer = await response.buffer();
        doc.image(logoBuffer, (pageWidth - watermarkWidth) / 2, (pageHeight - watermarkWidth) / 2, { width: watermarkWidth });
      }
    } catch(e) {
      console.log(`[${requestId}] ⚠ Error al cargar marca de agua:`, e.message);
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
    
    // Imagen Logo Izquierda
    const logoWidth = cmToPoints(CONFIG.cabecera.logoWidthCm);
    try {
      const logoUrl = isSpanish ? 'https://www.revistacienciasestudiantes.com/logo.png' : 'https://www.revistacienciasestudiantes.com/logoEN.png';
      const response = await fetch(logoUrl);
      if (response.ok) {
        const logoBuffer = await response.buffer();
        doc.image(logoBuffer, marginX, currentY, { width: logoWidth });
      } else {
        // Placeholder si no hay logo
        doc.rect(marginX, currentY, logoWidth, logoWidth).strokeColor('#CCCCCC').lineWidth(1).stroke();
        doc.font(fontSans).fontSize(9).fillColor(textGray).text('LOGO', marginX, currentY + logoWidth/2 - 5, { width: logoWidth, align: 'center' });
      }
    } catch(e) {
      console.log(`[${requestId}] ⚠ Error al cargar logo:`, e.message);
      // Placeholder si hay error
      doc.rect(marginX, currentY, logoWidth, logoWidth).strokeColor('#CCCCCC').lineWidth(1).stroke();
      doc.font(fontSans).fontSize(9).fillColor(textGray).text('LOGO', marginX, currentY + logoWidth/2 - 5, { width: logoWidth, align: 'center' });
    }
    
    // Bloque de Textos Cabecera
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
    
    // Título Principal
    doc.font(fontSansBold).fontSize(26).fillColor(journalBlue)
       .text(texts.certificateTitle, marginX, bodyStartY, { width: contentWidth, align: 'center', characterSpacing: 1 });
    
    // Texto introductorio
    doc.font(fontSerif).fontSize(13.5).fillColor(textDark)
       .text(texts.introText, 
             marginX, bodyStartY + cmToPoints(1.4), { width: contentWidth, align: 'center' });
    
    // TÍTULO DEL ARTÍCULO
    doc.font(fontSansBold).fontSize(16.5).fillColor(journalBlue)
       .text(`«${data.title}»`, 
             marginX + cmToPoints(0.5), bodyStartY + cmToPoints(2.3), { width: contentWidth - cmToPoints(1), align: 'center', lineGap: 4 });
    
    let afterTitleY = doc.y + cmToPoints(0.4);
    
    // Texto intermedio
    doc.font(fontSerif).fontSize(13.5).fillColor(textDark)
       .text(texts.authoredBy, marginX, afterTitleY, { width: contentWidth, align: 'center' });
    
    // AUTORES
    doc.font(fontSerifSemiBold).fontSize(16).fillColor(textDark)
       .text(authorsList, 
             marginX + cmToPoints(0.5), afterTitleY + cmToPoints(0.6), { width: contentWidth - cmToPoints(1), align: 'center', lineGap: 4 });
    
    let afterAuthorsY = doc.y + cmToPoints(0.7);
    
    // RESOLUCIÓN
    const resBoxWidth = contentWidth - cmToPoints(2);
    const resBoxX = marginX + cmToPoints(1);
    
    doc.font(fontSerif).fontSize(12.5).fillColor(textDark)
       .text(texts.resolution, 
             resBoxX, afterAuthorsY, { width: resBoxWidth, align: 'center', lineGap: 3 });
    
    // ==========================================
    // PIE CON QR DE AUTENTICIDAD
    // ==========================================
    const footerY = pageHeight - cmToPoints(4.5);
    
    // Bloque Izquierdo: Metadatos
    doc.font(fontSansBold).fontSize(10).fillColor(textSlate)
       .text(`${texts.manuscriptIdLabel} `, marginX, footerY, { continued: true })
       .font(fontSans).text(data.submissionId);
       
    doc.font(fontSansBold)
       .text(`${texts.acceptanceDateLabel} `, marginX, footerY + 16, { continued: true })
       .font(fontSans).text(formattedDate);
    
    // Bloque Central: Sello y Lema
    const colCenterWidth = contentWidth * 0.35;
    const colCenterX = marginX + (contentWidth * 0.325);
    doc.font(fontSerifItalic).fontSize(11).fillColor(journalBlue)
       .text(texts.mottoText, colCenterX, footerY, { width: colCenterWidth, align: 'center' });
    
    // Bloque Derecho: QR e Información
    const colRightWidth = contentWidth * 0.35;
    const colRightX = marginX + (contentWidth * 0.65);
    
    // Área para el QR
    const qrAreaWidth = cmToPoints(3);
    const qrAreaX = colRightX + (colRightWidth - qrAreaWidth) / 2;
    const qrAreaY = footerY + cmToPoints(0.5);
    
    // Texto "Verificar autenticidad" antes del QR
    doc.font(fontSansBold).fontSize(9).fillColor(journalBlue)
       .text(texts.verifyLabel, colRightX, qrAreaY - cmToPoints(0.8), { 
           width: colRightWidth, 
           align: 'center' 
       });
    
    // Generar e insertar QR
    try {
      const qrDataURL = await QRCode.toDataURL(CONFIG.urlVerificacion, {
        errorCorrectionLevel: CONFIG.qr.errorCorrection,
        margin: CONFIG.qr.margin,
        width: 500,
        color: {
          dark: '#003B5C',
          light: '#FFFFFF'
        }
      });
      
      const qrBuffer = Buffer.from(qrDataURL.split(',')[1], 'base64');
      const qrSize = cmToPoints(CONFIG.qr.sizeCm);
      const qrX = qrAreaX + (qrAreaWidth - qrSize) / 2 + cmToPoints(CONFIG.qr.offsetXCm);
      const qrY = qrAreaY + cmToPoints(CONFIG.qr.offsetYCm);
      
      doc.image(qrBuffer, qrX, qrY, {
        width: qrSize,
        height: qrSize
      });
      
      console.log(`[${requestId}] ✅ QR insertado correctamente`);
    } catch (qrError) {
      console.error(`[${requestId}] ❌ Error al insertar QR:`, qrError.message);
    }
    
    // Finalizar documento
    doc.end();
    
    // Esperar a que termine la generación
    const pdfBuffer = await pdfPromise;
    console.log(`[${requestId}] ✅ PDF generado: ${(pdfBuffer.length / 1024).toFixed(2)}KB`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generando PDF:`, error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

/* ===================== FUNCIÓN: GENERAR CERTIFICADO (SIN EMAIL) ===================== */
async function generateAcceptanceCertificate(submissionData, options = {}) {
  const requestId = `CERT-${submissionData.submissionId || 'unknown'}-${Date.now()}`;
  console.log(`[${requestId}] 🏆 Generando certificado de aceptación...`);
  
  try {
    const db = admin.firestore();
    
    // 1. Determinar idioma del certificado
    const lang = submissionData.paperLanguage || submissionData.language || 'es';
    const isSpanish = lang === 'es';
    
    console.log(`[${requestId}] 📝 Idioma del certificado: ${lang}`);
    
    // 2. Obtener metadatos finales consolidados
    const finalMetadata = submissionData.currentMetadata || submissionData;
    
    // 3. Preparar datos para el certificado
    const certificateData = {
      title: finalMetadata.title || submissionData.title || 'Sin título',
      authors: finalMetadata.authors || submissionData.authors || [],
      submissionId: submissionData.submissionId,
      acceptanceDate: options.acceptanceDate || 
        (submissionData.acceptedAt?.toDate?.() || new Date()).toISOString().split('T')[0],
      certificateNumber: `RNCE-${submissionData.submissionId?.substring(0, 8) || 'XXXXXXXX'}-${new Date().getFullYear()}`,
      volume: submissionData.volumen || 'En prensa',
      issue: submissionData.numero || 'En prensa',
      pages: submissionData.primeraPagina && submissionData.ultimaPagina 
        ? `${submissionData.primeraPagina}-${submissionData.ultimaPagina}`
        : 'En prensa',
      doi: submissionData.doi || null
    };
    
    console.log(`[${requestId}] 📊 Datos del certificado:`, {
      title: certificateData.title.substring(0, 50) + '...',
      authorsCount: certificateData.authors.length,
      certNumber: certificateData.certificateNumber,
      acceptanceDate: certificateData.acceptanceDate
    });
    
    // 4. Generar PDF con PDFKit
    const pdfBuffer = await generateCertificatePDF(certificateData, lang, requestId);
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF vacío generado');
    }
    
    console.log(`[${requestId}] 📄 PDF generado: ${(pdfBuffer.length / 1024).toFixed(2)}KB`);
    
    // 5. Inicializar Drive
    const { drive } = await getDriveClient(requestId);
    
    // 6. Obtener o crear carpeta para certificados
    const editorialFolderId = submissionData.editorialFolderId || submissionData.driveFolderId;
    
    if (!editorialFolderId) {
      throw new Error('No se encontró carpeta editorial para el submission');
    }
    
    // Crear subcarpeta para certificados
    const certificateFolderName = `CERTIFICATES_${submissionData.submissionId}`;
    let certificateFolder;
    
    try {
      // Intentar buscar carpeta existente
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
    
    // 7. Subir PDF a Drive
    const fileName = `CERTIFICATE_${submissionData.submissionId}_${Date.now()}.pdf`;
    const pdfBase64 = pdfBuffer.toString('base64');
    
    const certificateFile = await uploadToDrive(
      drive,
      pdfBase64,
      fileName,
      certificateFolder.id
    );
    
    console.log(`[${requestId}] ✅ Certificado subido a Drive: ${certificateFile.id}`);
    console.log(`[${requestId}] 🔗 URL: ${certificateFile.webViewLink}`);
    
    // 8. Guardar referencia en Firestore
    const certificateRef = {
      fileId: certificateFile.id,
      fileUrl: certificateFile.webViewLink,
      fileName: certificateFile.name,
      certificateNumber: certificateData.certificateNumber,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedBy: 'system',
      language: lang,
      acceptanceDate: certificateData.acceptanceDate
    };
    
    await db.collection('submissions').doc(submissionData.submissionId).update({
      certificate: certificateRef,
      certificateGenerated: true
    });
    
    console.log(`[${requestId}] 💾 Referencia guardada en Firestore`);
    
    // 9. Registrar en audit log
    await db.collection('submissions').doc(submissionData.submissionId)
      .collection('auditLogs').add({
        action: 'certificate_generated',
        certificateId: certificateFile.id,
        certificateUrl: certificateFile.webViewLink,
        certificateNumber: certificateData.certificateNumber,
        language: lang,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    
    // NOTA: NO se envía email (según requerimiento)
    console.log(`[${requestId}] 📧 Email NO enviado (según configuración del script)`);
    
    return {
      success: true,
      certificateId: certificateFile.id,
      certificateUrl: certificateFile.webViewLink,
      certificateNumber: certificateData.certificateNumber,
      language: lang
    };
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generando certificado:`, error.message);
    throw error;
  }
}

/* ===================== FUNCIÓN: PROCESAR SUBMISSION INDIVIDUAL ===================== */
async function processSubmission(submissionDoc, articleMatch) {
  const submissionData = submissionDoc.data();
  const submissionId = submissionDoc.id;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 Procesando: ${submissionId}`);
  console.log(`${'='.repeat(80)}`);
  
  try {
    // Verificar si ya tiene certificado generado
    if (submissionData.certificateGenerated === true && submissionData.certificate) {
      console.log(`   ⏭️ Ya tiene certificado generado, saltando...`);
      return { success: false, reason: 'already_has_certificate' };
    }
    
    // Preparar datos del submission
    const finalMetadata = submissionData.currentMetadata || submissionData;
    
    // Determinar título y autores
    const title = finalMetadata.title || submissionData.title;
    const authors = finalMetadata.authors || submissionData.authors || [];
    
    if (!title) {
      console.log(`   ⚠️ Sin título, saltando...`);
      return { success: false, reason: 'no_title' };
    }
    
    // Obtener fecha de aceptación
    let acceptanceDate = null;
    
    if (articleMatch && articleMatch.acceptedDate) {
      acceptanceDate = articleMatch.acceptedDate;
      console.log(`   📅 Fecha de aceptación desde JSON: ${acceptanceDate}`);
    } else if (submissionData.acceptedAt) {
      acceptanceDate = normalizeDate(submissionData.acceptedAt).toISOString().split('T')[0];
      console.log(`   📅 Fecha de aceptación desde Firestore: ${acceptanceDate}`);
    } else if (submissionData.decisionMadeAt) {
      acceptanceDate = normalizeDate(submissionData.decisionMadeAt).toISOString().split('T')[0];
      console.log(`   📅 Fecha de aceptación desde decisionMadeAt: ${acceptanceDate}`);
    } else {
      acceptanceDate = new Date().toISOString().split('T')[0];
      console.log(`   📅 Fecha de aceptación predeterminada: ${acceptanceDate}`);
    }
    
    // Preparar datos completos para el certificado
    const certificateSubmissionData = {
      ...submissionData,
      submissionId: submissionId,
      currentMetadata: finalMetadata,
      title: title,
      authors: authors,
      paperLanguage: finalMetadata.paperLanguage || submissionData.paperLanguage || 'es',
      editorialFolderId: submissionData.editorialFolderId || submissionData.driveFolderId,
      // Agregar campos del JSON si existen
      ...(articleMatch ? {
        volumen: articleMatch.volumen || null,
        numero: articleMatch.numero || null,
        primeraPagina: articleMatch.primeraPagina || null,
        ultimaPagina: articleMatch.ultimaPagina || null,
        doi: articleMatch.doi || null
      } : {})
    };
    
    console.log(`   📝 Título: "${title.substring(0, 60)}${title.length > 60 ? '...' : ''}"`);
    console.log(`   👥 Autores: ${authors.length}`);
    console.log(`   🗣️ Idioma: ${certificateSubmissionData.paperLanguage}`);
    
    // Verificar carpeta editorial
    if (!certificateSubmissionData.editorialFolderId) {
      console.log(`   ⚠️ Sin carpeta editorial, intentando obtener de Drive...`);
      
      // Intentar obtener carpeta de Drive si no está en el documento
      const { drive } = await getDriveClient(`CERT-${submissionId}`);
      
      // Buscar carpeta por nombre
      if (submissionData.driveFolderId) {
        certificateSubmissionData.editorialFolderId = submissionData.driveFolderId;
      } else {
        console.log(`   ❌ No se encontró carpeta editorial, saltando...`);
        return { success: false, reason: 'no_editorial_folder' };
      }
    }
    
    // Generar certificado
    const result = await generateAcceptanceCertificate(certificateSubmissionData, {
      acceptanceDate: acceptanceDate
    });
    
    console.log(`   ✅ Certificado generado exitosamente`);
    console.log(`   🔗 URL: ${result.certificateUrl}`);
    console.log(`   🔢 Número: ${result.certificateNumber}`);
    
    return result;
    
  } catch (error) {
    console.error(`   ❌ Error procesando submission:`, error.message);
    return { success: false, reason: 'error', error: error.message };
  }
}

/* ===================== FUNCIÓN PRINCIPAL ===================== */
async function main() {
  console.log('🚀 Iniciando script de generación de certificados...');
  console.log(`📚 Total de artículos en JSON: ${articlesJson.length}`);
  console.log(`⏰ Inicio: ${new Date().toISOString()}`);
  
  try {
    // Obtener submissions de Firestore
    const submissionsRef = db.collection('submissions');
    const snapshot = await submissionsRef.get();
    
    console.log(`\n📦 Total de submissions en Firestore: ${snapshot.docs.length}`);
    
    // Filtrar submissions aceptados y publicados
    const relevantSubmissions = [];
    const processedIds = new Set();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Verificar si está aceptado o publicado
      const isAccepted = data.status === 'accepted' || data.finalDecision === 'accept';
      const isPublished = data.status === 'published' || data.statusFixedAt || data.publicationReady === true;
      
      if (isAccepted || isPublished) {
        relevantSubmissions.push(doc);
        processedIds.add(doc.id);
        
        console.log(`\n   ✓ Encontrado submission relevante: ${doc.id}`);
        console.log(`      - Status: ${data.status || 'N/A'}`);
        console.log(`      - Final Decision: ${data.finalDecision || 'N/A'}`);
        console.log(`      - Publication Ready: ${data.publicationReady || false}`);
        console.log(`      - Título: ${(data.title || (data.currentMetadata?.title) || 'Sin título').substring(0, 60)}...`);
      }
    }
    
    console.log(`\n📊 Total de submissions relevantes: ${relevantSubmissions.length}`);
    
    // Matchear con articles.json
    const matchedSubmissions = [];
    const unmatchedSubmissions = [];
    
    for (const doc of relevantSubmissions) {
      const data = doc.data();
      
      // Verificar si está en articles.json (publicados)
      const match = matchArticleWithJson(data, articlesJson);
      
      if (match) {
        matchedSubmissions.push({ doc, match });
        console.log(`\n   🎯 Match encontrado:`);
        console.log(`      - Submission: ${doc.id}`);
        console.log(`      - JSON: "${match.titulo}"`);
        console.log(`      - Fecha aceptación JSON: ${match.acceptedDate || 'N/A'}`);
      } else {
        // Si está aceptado pero no publicado (no está en JSON), verificar si igual procesamos
        const isAcceptedOnly = data.status === 'accepted' && !data.statusFixedAt;
        
        if (isAcceptedOnly) {
          console.log(`\n   ⏭️ Aceptado pero no publicado (no en JSON): ${doc.id}`);
          console.log(`      - Título: ${(data.title || 'Sin título').substring(0, 60)}...`);
          unmatchedSubmissions.push(doc);
        } else {
          console.log(`\n   ⚠️ No se encontró match en JSON: ${doc.id}`);
          console.log(`      - Título: ${(data.title || (data.currentMetadata?.title) || 'Sin título').substring(0, 60)}...`);
          unmatchedSubmissions.push(doc);
        }
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📈 Resumen:`);
    console.log(`   - Total submissions relevantes: ${relevantSubmissions.length}`);
    console.log(`   - Matcheados con JSON: ${matchedSubmissions.length}`);
    console.log(`   - Sin match: ${unmatchedSubmissions.length}`);
    console.log(`${'='.repeat(80)}`);
    
    // Procesar submissions matcheados
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    
    for (const { doc, match } of matchedSubmissions) {
      const result = await processSubmission(doc, match);
      results.push({ submissionId: doc.id, ...result });
      
      if (result.success === true) {
        successCount++;
      } else if (result.reason === 'already_has_certificate' || result.reason === 'no_editorial_folder' || result.reason === 'no_title') {
        skipCount++;
      } else {
        errorCount++;
      }
      
      // Pequeña pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Mostrar resumen final
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 PROCESO COMPLETADO`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Resultados:`);
    console.log(`   ✅ Certificados generados exitosamente: ${successCount}`);
    console.log(`   ⏭️ Saltados (ya tenían certificado, sin carpeta, etc.): ${skipCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📦 Total procesados: ${matchedSubmissions.length}`);
    
    // Mostrar detalle de resultados
    if (results.length > 0) {
      console.log(`\n📋 Detalle:`);
      for (const result of results) {
        const statusEmoji = result.success === true ? '✅' : (result.reason === 'already_has_certificate' ? '⏭️' : '❌');
        console.log(`   ${statusEmoji} ${result.submissionId}: ${result.success === true ? `Éxito - ${result.certificateNumber}` : (result.reason || 'Error')}`);
      }
    }
    
    console.log(`\n⏰ Fin: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error(`\n❌ Error fatal en el script:`, error);
    throw error;
  }
}

// Ejecutar script
main()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });