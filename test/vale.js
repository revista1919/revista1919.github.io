// test-docx.js
// Script para fusionar portada premium + estandarizar tipografía
// Preserva contenido complejo (ecuaciones, figuras, tablas)
// Estandariza fuentes y tamaños de texto
// Ejecutar: node test-docx.js

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const https = require('https');

// Librería docx para generar la portada
const { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  ImageRun, AlignmentType, BorderStyle, WidthType, HeadingLevel,
  VerticalAlign, PageBreak, PageOrientation
} = require('docx');

// ===================== CONFIGURACIÓN =====================
const COLORS = {
  primary: "003B5C",
  accent: "E86125",
  textDark: "1F2937",
  textMuted: "64748B",
  border: "E2E8F0",
  bgLight: "F8FAFC"
};

// Configuración de tipografía estandarizada
const TYPOGRAPHY = {
  // Texto normal
  body: {
    font: "Georgia",
    size: 22, // 11pt (en half-points)
    color: COLORS.textDark,
    lineSpacing: 360, // 1.5
    alignment: "both" // justificado
  },
  // Título principal (Heading 1)
  heading1: {
    font: "Helvetica",
    size: 32, // 16pt
    color: COLORS.primary,
    bold: true,
    spacingBefore: 400,
    spacingAfter: 200
  },
  // Subtítulo (Heading 2)
  heading2: {
    font: "Helvetica",
    size: 28, // 14pt
    color: COLORS.primary,
    bold: true,
    spacingBefore: 300,
    spacingAfter: 150
  },
  // Sub-subtítulo (Heading 3)
  heading3: {
    font: "Helvetica",
    size: 24, // 12pt
    color: COLORS.primary,
    bold: true,
    italic: true,
    spacingBefore: 250,
    spacingAfter: 100
  },
  // Título 4
  heading4: {
    font: "Georgia",
    size: 22, // 11pt
    color: COLORS.textDark,
    bold: true,
    spacingBefore: 200,
    spacingAfter: 80
  }
};

// Datos de prueba
const submissionData = {
  submissionId: "SUB-TEST-12345",
  area: "Ciencias Biológicas",
  articleType: "Research Article",
  paperLanguage: 'es',
  title: "Impacto de los Espacios Verdes Urbanos en la Salud Mental de Estudiantes Universitarios",
  titleEn: "Impact of Urban Green Spaces on Mental Health of University Students",
  abstract: "Este estudio analiza la relación entre la exposición a espacios verdes urbanos y la salud mental de estudiantes universitarios.",
  abstractEn: "This study analyzes the relationship between exposure to urban green spaces and mental health of university students.",
  keywordsEs: ["espacios verdes", "salud mental", "estudiantes universitarios"],
  keywordsEn: ["green spaces", "mental health", "university students"],
  specializedCodesSerialized: "Q5; I12; J24",
  keywordsVocabulario: "JEL"
};

// ===================== FUNCIONES AUXILIARES =====================
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Error descargando imagen: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

// ===================== GENERAR PORTADA CON DOCX =====================
async function generateCoverDocx() {
  const children = [];
  
  // Descargar logo
  let logoBuffer = null;
  try {
    console.log('🖼️ Descargando logo...');
    const logoUrl = submissionData.paperLanguage === 'es' 
      ? 'https://www.revistacienciasestudiantes.com/logo.png'
      : 'https://www.revistacienciasestudiantes.com/logoEN.png';
    
    logoBuffer = await downloadImage(logoUrl);
    console.log(`✅ Logo descargado: ${(logoBuffer.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.warn(`⚠️ No se pudo descargar el logo:`, error.message);
  }
  
  // Logo
  if (logoBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 140, height: 140 },
          }),
        ],
      })
    );
  }
  
  // Título de la revista
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES",
          bold: true,
          color: COLORS.primary,
          size: 22,
          font: "Helvetica",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "National Review of Sciences for Students",
          color: COLORS.textMuted,
          size: 16,
          font: "Helvetica",
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
      children: [
        new TextRun({
          text: "─────────",
          color: COLORS.accent,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: submissionData.title,
          bold: true,
          color: COLORS.primary,
          size: 28,
          font: "Georgia",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: submissionData.titleEn,
          italics: true,
          color: COLORS.textMuted,
          size: 20,
          font: "Georgia",
        }),
      ],
    })
  );
  
  // Tabla de metadatos
  children.push(createMetadataTable());
  
  // Salto de página
  children.push(new Paragraph({ children: [new PageBreak()] }));
  
  // Resumen
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 4 }
      },
      children: [
        new TextRun({
          text: "RESUMEN",
          bold: true,
          color: COLORS.primary,
          size: 24,
          font: "Helvetica",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 300, line: 360 },
      children: [
        new TextRun({
          text: submissionData.abstract,
          color: COLORS.textDark,
          size: 22,
          font: "Georgia",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: "Palabras clave: ",
          bold: true,
          color: COLORS.primary,
          size: 20,
          font: "Helvetica",
        }),
        new TextRun({
          text: submissionData.keywordsEs.join(" · "),
          color: COLORS.textDark,
          size: 20,
          italics: true,
          font: "Georgia",
        }),
      ],
    })
  );
  
  // Abstract
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary, space: 4 }
      },
      children: [
        new TextRun({
          text: "ABSTRACT",
          bold: true,
          color: COLORS.primary,
          size: 24,
          font: "Helvetica",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 300, line: 360 },
      children: [
        new TextRun({
          text: submissionData.abstractEn,
          color: COLORS.textDark,
          size: 22,
          font: "Georgia",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: "Keywords: ",
          bold: true,
          color: COLORS.primary,
          size: 20,
          font: "Helvetica",
        }),
        new TextRun({
          text: submissionData.keywordsEn.join(" · "),
          color: COLORS.textDark,
          size: 20,
          italics: true,
          font: "Georgia",
        }),
      ],
    })
  );
  
  // Salto de página antes del contenido original
  children.push(new Paragraph({ children: [new PageBreak()] }));
  
  // Generar documento
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Georgia", size: 22, color: COLORS.textDark },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: children,
    }],
  });
  
  return await Packer.toBuffer(doc);
}

function createMetadataTable() {
  const borderThick = { style: BorderStyle.SINGLE, size: 12, color: COLORS.primary };
  const borderThin = { style: BorderStyle.SINGLE, size: 4, color: COLORS.border };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const tableBorders = {
    top: borderThick,
    bottom: borderThick,
    left: noBorder,
    right: noBorder,
    insideHorizontal: borderThin,
    insideVertical: noBorder,
  };

  const createRow = (label, value, isMonospace = false) => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          borders: { top: noBorder, bottom: borderThin, left: noBorder, right: noBorder },
          shading: { fill: COLORS.bgLight },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 150, right: 150 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label.toUpperCase(),
                  bold: true,
                  color: COLORS.primary,
                  size: 16,
                  font: "Helvetica",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          borders: { top: noBorder, bottom: borderThin, left: noBorder, right: noBorder },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 150, right: 150 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: value || 'No especificado',
                  color: COLORS.textDark,
                  size: 18,
                  font: isMonospace ? "Courier New" : "Georgia",
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('es-CL', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatKeywords = (kw) => Array.isArray(kw) ? kw.join('; ') : '';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      createRow("ID del Manuscrito", submissionData.submissionId, true),
      createRow("Fecha de Recepción", formatDate()),
      createRow("Área Temática", submissionData.area),
      createRow("Tipo de Artículo", (submissionData.articleType || '').toUpperCase()),
      createRow("Idioma del Texto", submissionData.paperLanguage === 'es' ? 'Español' : 'English'),
      createRow("Palabras Clave (ES)", formatKeywords(submissionData.keywordsEs)),
      createRow("Keywords (EN)", formatKeywords(submissionData.keywordsEn)),
      createRow("Códigos de Clasificación", `${submissionData.specializedCodesSerialized || ''} (${submissionData.keywordsVocabulario || 'N/A'})`),
    ],
  });
}

// ===================== ESTANDARIZAR ESTILOS =====================
async function standardizeStyles(originalZip) {
  console.log('🎨 Estandarizando tipografía...');
  
  try {
    const stylesPath = 'word/styles.xml';
    
    if (!originalZip.file(stylesPath)) {
      console.warn('⚠️ No se encontró styles.xml');
      return;
    }
    
    let stylesXml = await originalZip.file(stylesPath).async('string');
    
    // ===================== ESTILO NORMAL =====================
    // Reemplazar el estilo Normal (párrafo base)
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:default="1" w:styleId="Normal">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
        <w:name w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:line="360" w:lineRule="auto"/>
          <w:jc w:val="both"/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.body.font}" w:hAnsi="${TYPOGRAPHY.body.font}" w:eastAsia="${TYPOGRAPHY.body.font}" w:cs="${TYPOGRAPHY.body.font}"/>
          <w:color w:val="${TYPOGRAPHY.body.color}"/>
          <w:sz w:val="${TYPOGRAPHY.body.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.body.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // ===================== HEADING 1 =====================
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading1">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading1.spacingBefore}" w:after="${TYPOGRAPHY.heading1.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading1.font}" w:hAnsi="${TYPOGRAPHY.heading1.font}" w:eastAsia="${TYPOGRAPHY.heading1.font}" w:cs="${TYPOGRAPHY.heading1.font}"/>
          <w:b/>
          <w:color w:val="${TYPOGRAPHY.heading1.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading1.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading1.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // ===================== HEADING 2 =====================
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading2">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading2">
        <w:name w:val="heading 2"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading2.spacingBefore}" w:after="${TYPOGRAPHY.heading2.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading2.font}" w:hAnsi="${TYPOGRAPHY.heading2.font}" w:eastAsia="${TYPOGRAPHY.heading2.font}" w:cs="${TYPOGRAPHY.heading2.font}"/>
          <w:b/>
          <w:color w:val="${TYPOGRAPHY.heading2.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading2.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading2.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // ===================== HEADING 3 =====================
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading3">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading3">
        <w:name w:val="heading 3"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading3.spacingBefore}" w:after="${TYPOGRAPHY.heading3.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading3.font}" w:hAnsi="${TYPOGRAPHY.heading3.font}" w:eastAsia="${TYPOGRAPHY.heading3.font}" w:cs="${TYPOGRAPHY.heading3.font}"/>
          <w:b/>
          <w:i/>
          <w:color w:val="${TYPOGRAPHY.heading3.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading3.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading3.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // ===================== HEADING 4 =====================
    stylesXml = stylesXml.replace(
      /<w:style w:type="paragraph" w:styleId="Heading4">[\s\S]*?<\/w:style>/,
      `<w:style w:type="paragraph" w:styleId="Heading4">
        <w:name w:val="heading 4"/>
        <w:basedOn w:val="Normal"/>
        <w:next w:val="Normal"/>
        <w:qFormat/>
        <w:pPr>
          <w:spacing w:before="${TYPOGRAPHY.heading4.spacingBefore}" w:after="${TYPOGRAPHY.heading4.spacingAfter}"/>
          <w:keepNext/>
        </w:pPr>
        <w:rPr>
          <w:rFonts w:ascii="${TYPOGRAPHY.heading4.font}" w:hAnsi="${TYPOGRAPHY.heading4.font}" w:eastAsia="${TYPOGRAPHY.heading4.font}" w:cs="${TYPOGRAPHY.heading4.font}"/>
          <w:b/>
          <w:color w:val="${TYPOGRAPHY.heading4.color}"/>
          <w:sz w:val="${TYPOGRAPHY.heading4.size}"/>
          <w:szCs w:val="${TYPOGRAPHY.heading4.size}"/>
        </w:rPr>
      </w:style>`
    );
    
    // Guardar styles.xml modificado
    originalZip.file(stylesPath, stylesXml);
    
    console.log('✅ Tipografía estandarizada:');
    console.log(`   - Texto normal: ${TYPOGRAPHY.body.font} ${TYPOGRAPHY.body.size / 2}pt`);
    console.log(`   - Heading 1: ${TYPOGRAPHY.heading1.font} ${TYPOGRAPHY.heading1.size / 2}pt bold`);
    console.log(`   - Heading 2: ${TYPOGRAPHY.heading2.font} ${TYPOGRAPHY.heading2.size / 2}pt bold`);
    console.log(`   - Heading 3: ${TYPOGRAPHY.heading3.font} ${TYPOGRAPHY.heading3.size / 2}pt bold italic`);
    console.log(`   - Heading 4: ${TYPOGRAPHY.heading4.font} ${TYPOGRAPHY.heading4.size / 2}pt bold`);
    
  } catch (error) {
    console.warn('⚠️ Error estandarizando estilos:', error.message);
  }
}

// ===================== FUSIONAR DOCX =====================
async function mergeDocxWithOriginal(coverDocxBuffer, originalDocxPath, outputPath) {
  try {
    console.log('📖 Leyendo documento original...');
    const originalZip = await JSZip.loadAsync(fs.readFileSync(originalDocxPath));
    
    console.log('📖 Leyendo portada premium...');
    const coverZip = await JSZip.loadAsync(coverDocxBuffer);
    
    // ===================== FUSIONAR MEDIA =====================
    console.log('🖼️ Fusionando imágenes...');
    const coverMediaFolder = coverZip.folder('word/media');
    const originalMediaFolder = originalZip.folder('word/media');
    
    if (coverMediaFolder && originalMediaFolder) {
      const coverMediaFiles = Object.keys(coverMediaFolder.files);
      for (const filePath of coverMediaFiles) {
        if (coverMediaFolder.files[filePath].dir) continue;
        const fileName = filePath.split('/').pop();
        if (!originalZip.file(`word/media/${fileName}`)) {
          const content = await coverMediaFolder.files[filePath].async('nodebuffer');
          originalZip.file(`word/media/${fileName}`, content);
          console.log(`   ✅ ${fileName} copiado`);
        }
      }
    }
    
    // ===================== FUSIONAR RELACIONES =====================
    console.log('🔗 Fusionando relaciones...');
    const coverRelsPath = 'word/_rels/document.xml.rels';
    const originalRelsPath = 'word/_rels/document.xml.rels';
    
    const coverRels = await coverZip.file(coverRelsPath).async('string');
    let originalRels = await originalZip.file(originalRelsPath).async('string');
    
    const coverImageRels = coverRels.match(/<Relationship[^>]*Type="[^"]*\/image"[^>]*>/g) || [];
    
    let maxRId = 0;
    const allRIds = originalRels.match(/Id="rId(\d+)"/g) || [];
    for (const rId of allRIds) {
      const num = parseInt(rId.match(/\d+/)[0]);
      if (num > maxRId) maxRId = num;
    }
    
    const rIdMap = {};
    for (let i = 0; i < coverImageRels.length; i++) {
      const oldRId = coverImageRels[i].match(/Id="([^"]+)"/)[1];
      const newRId = `rId${maxRId + i + 1}`;
      rIdMap[oldRId] = newRId;
      
      const target = coverImageRels[i].match(/Target="([^"]+)"/)[1];
      const newRel = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
      originalRels = originalRels.replace('</Relationships>', `${newRel}</Relationships>`);
    }
    
    await originalZip.file(originalRelsPath, originalRels);
    
    // ===================== FUSIONAR DOCUMENT.XML =====================
    console.log('📄 Fusionando contenido...');
    const coverDocumentXml = await coverZip.file('word/document.xml').async('string');
    const originalDocumentXml = await originalZip.file('word/document.xml').async('string');
    
    let mergedCoverXml = coverDocumentXml;
    for (const [oldRId, newRId] of Object.entries(rIdMap)) {
      mergedCoverXml = mergedCoverXml.replace(new RegExp(`r:embed="${oldRId}"`, 'g'), `r:embed="${newRId}"`);
    }
    
    const coverBodyMatch = mergedCoverXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
    if (!coverBodyMatch) {
      throw new Error('No se encontró <w:body> en la portada');
    }
    
    const coverBodyContent = coverBodyMatch[1];
    
    const originalBodyMatch = originalDocumentXml.match(/(<w:body[^>]*>)/);
    if (!originalBodyMatch) {
      throw new Error('No se encontró <w:body> en el original');
    }
    
    const insertPosition = originalBodyMatch.index + originalBodyMatch[1].length;
    
    const newDocumentXml = 
      originalDocumentXml.substring(0, insertPosition) + 
      coverBodyContent + 
      originalDocumentXml.substring(insertPosition);
    
    await originalZip.file('word/document.xml', newDocumentXml);
    
    // ===================== ESTANDARIZAR ESTILOS =====================
    await standardizeStyles(originalZip);
    
    // ===================== GENERAR DOCX FINAL =====================
    console.log('💾 Generando documento final...');
    const outputBuffer = await originalZip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    fs.writeFileSync(outputPath, outputBuffer);
    
    console.log(`✅ Documento fusionado guardado: ${outputPath}`);
    console.log(`📦 Tamaño: ${(outputBuffer.length / 1024).toFixed(2)} KB`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error fusionando documentos:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

// ===================== EJECUTAR =====================
async function main() {
  console.log('🎨 Generando documento premium...');
  console.log('');
  
  try {
    const originalPath = path.join(__dirname, 'articulo.docx');
    
    if (!fs.existsSync(originalPath)) {
      console.error(`❌ No se encontró el archivo: ${originalPath}`);
      console.log('💡 Coloca un archivo llamado "articulo.docx" en esta carpeta');
      return;
    }
    
    try {
      require.resolve('docx');
      require.resolve('jszip');
    } catch(e) {
      console.log('❌ Dependencias faltantes. Instalar con: npm install docx jszip');
      return;
    }
    
    console.log('📝 Generando portada premium...');
    const coverDocxBuffer = await generateCoverDocx();
    console.log(`✅ Portada generada: ${(coverDocxBuffer.length / 1024).toFixed(2)} KB`);
    
    const outputPath = path.join(__dirname, 'test-premium.docx');
    const success = await mergeDocxWithOriginal(coverDocxBuffer, originalPath, outputPath);
    
    if (success) {
      console.log('');
      console.log('💡 Abre el archivo test-premium.docx para ver el resultado');
      console.log('');
      console.log('✅ CONTENIDO PRESERVADO INTACTO:');
      console.log('   - Ecuaciones');
      console.log('   - Figuras e imágenes');
      console.log('   - Tablas del autor');
      console.log('   - Referencias cruzadas');
      console.log('   - Notas al pie');
      console.log('');
      console.log('✅ AGREGADO CON DISEÑO PREMIUM:');
      console.log('   - Portada con logo');
      console.log('   - Tabla de metadatos');
      console.log('   - Resumen y Abstract');
      console.log('');
      console.log('✅ TIPOGRAFÍA ESTANDARIZADA:');
      console.log('   - Texto normal: Georgia 11pt justificado');
      console.log('   - Heading 1: Helvetica 16pt bold azul');
      console.log('   - Heading 2: Helvetica 14pt bold azul');
      console.log('   - Heading 3: Helvetica 12pt bold italic azul');
      console.log('   - Interlineado: 1.5');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();