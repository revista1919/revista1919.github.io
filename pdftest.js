/* ===================== SCRIPT LOCAL: GENERAR CERTIFICADO PDF ===================== */
/**
 * Genera un certificado de aceptación PDF usando PDFKit
 * Fiel al diseño original con descarga de imágenes
 * Para ejecutar: node generateCertificate.js
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// ===================== CONFIGURACIÓN =====================
const CONFIG = {
  qr: {
    sizeCm: 2,
    offsetYCm: -0.5,
    offsetXCm: 0,
    errorCorrection: 'M',
    margin: 2,
    debug: false
  },
  urlVerificacion: 'https://www.revistacienciasestudiantes.com/verificar/RNCE-TEST2024-2024',
  cabecera: {
    marginTopCm: 2.2,
    extraSpaceCm: 0.3,
    logoWidthCm: 3.2,
    tituloSize: 22,
    subtituloSize: 16,
  },
  outputDir: './certificados_generados',
  logoUrlES: 'https://www.revistacienciasestudiantes.com/logo.png',
  logoUrlEN: 'https://www.revistacienciasestudiantes.com/logoEN.png'
};

// ===================== DATOS DE SIMULACIÓN =====================
const simulationData = {
  title: 'Análisis de la Biodiversidad en Ecosistemas Urbanos: Un Estudio Longitudinal',
  authors: [
    { firstName: 'María', lastName: 'González', email: 'maria.gonzalez@email.com' },
    { firstName: 'Juan', lastName: 'Pérez', email: 'juan.perez@email.com' },
    { firstName: 'Carlos', lastName: 'Rodríguez', email: 'carlos.rodriguez@email.com' }
  ],
  submissionId: 'TEST2024',
  acceptanceDate: new Date().toISOString().split('T')[0],
  certificateNumber: 'RNCE-TEST2024-2024'
};

// ===================== FUNCIONES AUXILIARES =====================
function mmToPoints(mm) {
  return mm * 2.83465;
}

function cmToPoints(cm) {
  return cm * 28.3465;
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Directorio creado: ${dir}`);
  }
}

// Función para intentar descargar imagen desde URL
async function tryDownloadImage(url, requestId) {
  try {
    console.log(`[${requestId}] 📥 Intentando descargar imagen: ${url}`);
    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log(`[${requestId}] ✅ Imagen descargada: ${(buffer.byteLength / 1024).toFixed(2)}KB`);
      return Buffer.from(buffer);
    } else {
      console.log(`[${requestId}] ⚠️ Error HTTP ${response.status} al descargar imagen`);
      return null;
    }
  } catch (error) {
    console.log(`[${requestId}] ⚠️ Error al descargar imagen: ${error.message}`);
    return null;
  }
}

// ===================== FUNCIÓN PRINCIPAL =====================
async function generateCertificatePDF(data, lang = 'es', requestId = 'LOCAL-TEST') {
  console.log(`[${requestId}] 🔧 Generando PDF con PDFKit...`);
  
  try {
    const isSpanish = lang === 'es';
    
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
    
    console.log(`[${requestId}] 📊 Datos del certificado:`);
    console.log(`  - Título: ${data.title.substring(0, 50)}...`);
    console.log(`  - Autores: ${authorsList}`);
    console.log(`  - Número: ${data.certificateNumber}`);
    console.log(`  - Fecha: ${formattedDate}`);
    
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
    
    // Marca de agua (intenta cargar el logo)
    const watermarkWidth = cmToPoints(12);
    doc.save();
    doc.opacity(0.03);
    
    try {
      const logoUrl = isSpanish ? CONFIG.logoUrlES : CONFIG.logoUrlEN;
      const logoBuffer = await tryDownloadImage(logoUrl, requestId);
      
      if (logoBuffer) {
        doc.image(logoBuffer, (pageWidth - watermarkWidth) / 2, 
                  (pageHeight - watermarkWidth) / 2, { width: watermarkWidth });
        console.log(`[${requestId}] ✅ Marca de agua insertada`);
      } else {
        console.log(`[${requestId}] ⚠️ No se pudo cargar marca de agua, continuando sin ella`);
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
      const logoUrl = isSpanish ? CONFIG.logoUrlES : CONFIG.logoUrlEN;
      const logoBuffer = await tryDownloadImage(logoUrl, requestId);
      
      if (logoBuffer) {
        doc.image(logoBuffer, marginX, currentY, { width: logoWidth });
        console.log(`[${requestId}] ✅ Logo insertado correctamente`);
      } else {
        // Placeholder si no hay logo
        doc.rect(marginX, currentY, logoWidth, logoWidth)
           .strokeColor('#CCCCCC')
           .lineWidth(1)
           .stroke();
        doc.font(fontSans)
           .fontSize(9)
           .fillColor(textGray)
           .text('LOGO', marginX, currentY + logoWidth/2 - 5, { 
             width: logoWidth, 
             align: 'center' 
           });
        console.log(`[${requestId}] ⚠️ Usando placeholder para logo`);
      }
    } catch(e) {
      console.log(`[${requestId}] ⚠ Error al cargar logo:`, e.message);
      // Placeholder si hay error
      doc.rect(marginX, currentY, logoWidth, logoWidth)
         .strokeColor('#CCCCCC')
         .lineWidth(1)
         .stroke();
      doc.font(fontSans)
         .fontSize(9)
         .fillColor(textGray)
         .text('LOGO', marginX, currentY + logoWidth/2 - 5, { 
           width: logoWidth, 
           align: 'center' 
         });
    }
    
    // Bloque de Textos Cabecera
    const headerTextX = marginX + cmToPoints(3.8);
    const extraSpace = cmToPoints(CONFIG.cabecera.extraSpaceCm);
    
    doc.font(fontSansBold)
       .fontSize(CONFIG.cabecera.tituloSize)
       .fillColor(journalBlue)
       .text(texts.journalName1, headerTextX, currentY + extraSpace);
       
    doc.font(fontSansBold)
       .fontSize(CONFIG.cabecera.subtituloSize)
       .fillColor(journalBlue)
       .text(texts.journalName2, headerTextX, currentY + 26 + extraSpace);
       
    doc.font(fontSansItalic)
       .fontSize(8.5)
       .fillColor(textGray)
       .text(texts.journalNameEn, headerTextX, currentY + 48 + extraSpace);
       
    doc.font(fontSans)
       .fontSize(13)
       .fillColor(journalOrange)
       .text(texts.motto, headerTextX, currentY + 62 + extraSpace);
    
    // ==========================================
    // CUERPO DEL CERTIFICADO
    // ==========================================
    const bodyStartY = cmToPoints(6.5);
    
    // Título Principal
    doc.font(fontSansBold)
       .fontSize(26)
       .fillColor(journalBlue)
       .text(texts.certificateTitle, marginX, bodyStartY, { 
         width: contentWidth, 
         align: 'center', 
         characterSpacing: 1 
       });
    
    // Texto introductorio
    doc.font(fontSerif)
       .fontSize(13.5)
       .fillColor(textDark)
       .text(texts.introText, 
             marginX, bodyStartY + cmToPoints(1.4), { 
               width: contentWidth, 
               align: 'center' 
             });
    
    // TÍTULO DEL ARTÍCULO
    doc.font(fontSansBold)
       .fontSize(16.5)
       .fillColor(journalBlue)
       .text(`«${data.title}»`, 
             marginX + cmToPoints(0.5), 
             bodyStartY + cmToPoints(2.3), { 
               width: contentWidth - cmToPoints(1), 
               align: 'center', 
               lineGap: 4 
             });
    
    let afterTitleY = doc.y + cmToPoints(0.4);
    
    // Texto intermedio
    doc.font(fontSerif)
       .fontSize(13.5)
       .fillColor(textDark)
       .text(texts.authoredBy, marginX, afterTitleY, { 
         width: contentWidth, 
         align: 'center' 
       });
    
    // AUTORES
    doc.font(fontSerifSemiBold)
       .fontSize(16)
       .fillColor(textDark)
       .text(authorsList, 
             marginX + cmToPoints(0.5), 
             afterTitleY + cmToPoints(0.6), { 
               width: contentWidth - cmToPoints(1), 
               align: 'center', 
               lineGap: 4 
             });
    
    let afterAuthorsY = doc.y + cmToPoints(0.7);
    
    // RESOLUCIÓN
    const resBoxWidth = contentWidth - cmToPoints(2);
    const resBoxX = marginX + cmToPoints(1);
    
    doc.font(fontSerif)
       .fontSize(12.5)
       .fillColor(textDark)
       .text(texts.resolution, 
             resBoxX, afterAuthorsY, { 
               width: resBoxWidth, 
               align: 'center', 
               lineGap: 3 
             });
    
    // ==========================================
    // PIE CON QR DE AUTENTICIDAD
    // ==========================================
    const footerY = pageHeight - cmToPoints(4.5);
    
    // Bloque Izquierdo: Metadatos
    doc.font(fontSansBold)
       .fontSize(10)
       .fillColor(textSlate)
       .text(`${texts.manuscriptIdLabel} `, marginX, footerY, { continued: true })
       .font(fontSans)
       .text(data.submissionId);
       
    doc.font(fontSansBold)
       .text(`${texts.acceptanceDateLabel} `, marginX, footerY + 16, { continued: true })
       .font(fontSans)
       .text(formattedDate);
    
    // Bloque Central: Lema
    const colCenterWidth = contentWidth * 0.35;
    const colCenterX = marginX + (contentWidth * 0.325);
    doc.font(fontSerifItalic)
       .fontSize(11)
       .fillColor(journalBlue)
       .text(texts.mottoText, colCenterX, footerY, { 
         width: colCenterWidth, 
         align: 'center' 
       });
    
    // Bloque Derecho: QR e Información
    const colRightWidth = contentWidth * 0.35;
    const colRightX = marginX + (contentWidth * 0.65);
    
    // Área para el QR
    const qrAreaWidth = cmToPoints(3);
    const qrAreaX = colRightX + (colRightWidth - qrAreaWidth) / 2;
    const qrAreaY = footerY + cmToPoints(0.5);
    
    // Texto "Verificar autenticidad" antes del QR
    doc.font(fontSansBold)
       .fontSize(9)
       .fillColor(journalBlue)
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

// ===================== FUNCIÓN PARA GUARDAR PDF =====================
async function saveCertificateLocally(pdfBuffer, fileName) {
  try {
    ensureDirectoryExists(CONFIG.outputDir);
    
    const outputPath = path.join(CONFIG.outputDir, fileName);
    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log(`💾 PDF guardado en: ${outputPath}`);
    console.log(`📊 Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)}KB`);
    
    return outputPath;
  } catch (error) {
    console.error('❌ Error guardando PDF:', error.message);
    throw error;
  }
}

// ===================== FUNCIÓN PRINCIPAL =====================
async function main() {
  console.log('='.repeat(60));
  console.log('🏆 GENERADOR DE CERTIFICADOS - FIEL AL ORIGINAL');
  console.log('='.repeat(60));
  
  try {
    // Verificar dependencias
    console.log('📦 Verificando dependencias...');
    console.log(`  - PDFKit: ${require('pdfkit/package.json').version}`);
    console.log(`  - QRCode: ${require('qrcode/package.json').version}`);
    console.log(`  - Node.js: ${process.version}`);
    
    // Intentar descargar logos primero (para ver si están disponibles)
    console.log('\n🔍 Verificando disponibilidad de imágenes...');
    const logoES = await tryDownloadImage(CONFIG.logoUrlES, 'CHECK');
    const logoEN = await tryDownloadImage(CONFIG.logoUrlEN, 'CHECK');
    
    if (!logoES && !logoEN) {
      console.log('⚠️  Los logos no están disponibles. Se usarán placeholders.');
      console.log('   Para usar logos reales, coloca los archivos en:');
      console.log(`   - ${path.resolve('./assets/logo.png')}`);
      console.log(`   - ${path.resolve('./assets/logoEN.png')}`);
    }
    
    // Generar certificado en español
    console.log('\n🇪🇸 Generando certificado en español...');
    const pdfBufferES = await generateCertificatePDF(
      simulationData, 
      'es', 
      'LOCAL-ES'
    );
    
    const fileNameES = `certificado_${simulationData.certificateNumber}_es.pdf`;
    await saveCertificateLocally(pdfBufferES, fileNameES);
    
    // Generar certificado en inglés
    console.log('\n🇬🇧 Generando certificado en inglés...');
    const pdfBufferEN = await generateCertificatePDF(
      simulationData, 
      'en', 
      'LOCAL-EN'
    );
    
    const fileNameEN = `certificado_${simulationData.certificateNumber}_en.pdf`;
    await saveCertificateLocally(pdfBufferEN, fileNameEN);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESO COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`📁 Carpeta de salida: ${path.resolve(CONFIG.outputDir)}`);
    console.log('📄 Archivos generados:');
    console.log(`  - ${fileNameES}`);
    console.log(`  - ${fileNameEN}`);
    
    // Mostrar información del certificado
    console.log('\n📋 Información del certificado:');
    console.log(`  - Número: ${simulationData.certificateNumber}`);
    console.log(`  - Título: ${simulationData.title}`);
    console.log(`  - Autores: ${simulationData.authors.map(a => `${a.firstName} ${a.lastName}`).join(', ')}`);
    console.log(`  - Fecha: ${simulationData.acceptanceDate}`);
    console.log(`  - URL Verificación: ${CONFIG.urlVerificacion}`);
    
  } catch (error) {
    console.error('\n❌ ERROR EN EL PROCESO:');
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

// Exportar funciones para uso en otros scripts
module.exports = {
  generateCertificatePDF,
  saveCertificateLocally,
  simulationData
};