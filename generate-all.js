const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch').default;
const Papa = require('papaparse');

const articlesCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaLks9p32EM6-0VYy18AdREQwXdpeet1WHTA4H2-W2FX7HKe1HPSyApWadUw9sKHdVYQXL5tP6yDRs/pub?output=csv';
const teamCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const newsCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKnN8qMJcBN8im9Q61o-qElx1jQp5NdS80_B-FakCHrPLXHlQ_FXZWT0o5GVVHAM26l9sjLxsTCNO8/pub?output=csv';
const outputJson = path.join(__dirname, 'dist', 'articles.json');
const outputHtmlDir = path.join(__dirname, 'dist', 'articles');
const teamOutputHtmlDir = path.join(__dirname, 'dist', 'team');
const sectionsOutputDir = path.join(__dirname, 'dist', 'sections');
const sitemapPath = path.join(__dirname, 'dist', 'sitemap.xml');
const robotsPath = path.join(__dirname, 'dist', 'robots.txt');
const domain = 'https://www.revistacienciasestudiantes.com';
const journalEs = 'Revista Nacional de las Ciencias para Estudiantes';
const journalEn = 'The National Review of Sciences for Students';

function parseDateFlexible(dateStr) {
  if (!dateStr) return '';
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.toISOString().split('T')[0];
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map(p => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.toISOString().split('T')[0];
  }
  return dateStr;
}

function formatAuthorForCitation(author) {
  const parts = author.trim().split(' ');
  if (parts.length >= 2) {
    const apellido = parts.pop();
    const nombre = parts.join(' ');
    return `${apellido}, ${nombre}`;
  }
  return author;
}

function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function isBase64(str) {
  if (!str) return false;
  const base64Regex = /^data:image\/(png|jpe?g|gif);base64,/;
  return base64Regex.test(str);
}

function getImageSrc(image) {
  if (!image) return '';
  if (isBase64(image)) return image;
  if (image.startsWith('http')) return image;
  return '';
}

function generateHeader(lang) {
  const title = lang === 'es' ? journalEs : journalEn;
  const subtitle = lang === 'es' ? 'Una revista por y para estudiantes' : 'A review by and for students';
  return `
<header class="text-white p-3 sm:p-6 mb-4 sm:mb-6 relative" style="background-color: #52262dff;">
  <div class="container flex flex-col items-center justify-between">
    <div class="flex flex-col items-center mb-3 sm:mb-0 sm:flex-row sm:items-center">
      <img src="/logo.png" alt="Revista Logo" class="h-20 sm:h-24 lg:h-32 mb-2 sm:mb-0 sm:mr-5">
      <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold italic font-serif text-center">${title}</h1>
    </div>
    <p class="text-cream-100 text-xs sm:text-sm italic font-serif text-center sm:absolute sm:bottom-2 sm:right-4 sm:text-right">${subtitle}</p>
  </div>
</header>
  `.trim();
}

function generateFooter(lang) {
  const copyright = lang === 'es' ? '© 2025 Revista Nacional de las Ciencias para Estudiantes. Todos los derechos reservados.' : '© 2025 The National Review of Sciences for Students. All rights reserved.';
  const instagramText = lang === 'es' ? '@revistanacionalcienciae' : '@revistanacionalcienciae'; // Assume same handle
  const youtubeText = lang === 'es' ? 'Revista Nacional de las Ciencias' : 'The National Review of Sciences';
  const subscribeTitle = lang === 'es' ? 'Suscríbete a nuestra newsletter' : 'Subscribe to our newsletter';
  const subscribeP = lang === 'es' ? 'Recibe los últimos artículos y novedades.' : 'Receive the latest articles and news.';
  const namePlaceholder = lang === 'es' ? 'Tu nombre' : 'Your name';
  const emailPlaceholder = lang === 'es' ? 'Tu correo' : 'Your email';
  const subscribeButton = lang === 'es' ? 'Suscribirse' : 'Subscribe';
  const thanks = lang === 'es' ? '¡Gracias por suscribirte!' : 'Thank you for subscribing!';

  return `
<footer class="bg-gray-800 text-white p-4 sm:p-6 mt-6 text-center text-xs sm:text-sm">
  <p>${copyright}</p>
  <div class="flex flex-col sm:flex-row justify-center items-center gap-6 mt-4">
    <a href="https://www.instagram.com/revistanacionalcienciae" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center text-blue-400 hover:text-blue-500 text-center max-w-[200px]">
      <img src="/logoig.png" alt="Instagram" class="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1">
      <span class="underline">${instagramText}</span>
    </a>
    <a href="https://www.youtube.com/@RevistaNacionaldelasCienciaspa" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center text-red-400 hover:text-red-500 text-center max-w-[200px]">
      <img src="/logoyt.png" alt="YouTube" class="h-8 w-8 sm:h-6 sm:w-6 object-contain mb-1">
      <span class="underline">${youtubeText}</span>
    </a>
  </div>
  <div class="mt-6">
    <h3 class="text-lg font-semibold mb-2">${subscribeTitle}</h3>
    <p>${subscribeP}</p>
    <form id="newsletter-form-${lang}" class="flex flex-col sm:flex-row justify-center items-center gap-3 max-w-xl mx-auto mt-4">
      <input type="text" placeholder="${namePlaceholder}" required class="p-2 rounded border border-gray-400 w-full sm:w-auto text-gray-800">
      <input type="email" placeholder="${emailPlaceholder}" required class="p-2 rounded border border-gray-400 w-full sm:w-auto text-gray-800">
      <button type="submit" class="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-400 transition-colors font-semibold">${subscribeButton}</button>
    </form>
    <p id="thanks-message-${lang}" class="text-green-400 font-semibold mt-2 hidden">${thanks}</p>
  </div>
  <script>
    document.getElementById('newsletter-form-${lang}').addEventListener('submit', function(e) {
      e.preventDefault();
      // Script logic for submit, same as original
      const scriptURL = "https://script.google.com/macros/s/AKfycbzyyR93tD85nPprIKAR_IDoWYBSAnlFwVes09rJgOM3KQsByg_MgzafWDK1BcFhfVJHew/exec";
      const formData = new URLSearchParams();
      formData.append('nombre', e.target[0].value);
      formData.append('correo', e.target[1].value);
      fetch(scriptURL, { method: "POST", body: formData })
        .then(() => {
          document.getElementById('thanks-message-${lang}').style.display = 'block';
          e.target.reset();
        })
        .catch(err => alert("Error al enviar: " + err));
    });
  </script>
</footer>
  `.trim();
}

function getAboutContent(lang) {
  if (lang === 'es') {
    return `
<div class="about-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Quiénes Somos</h2>
  <p class="text-sm sm:text-base mb-2 sm:mb-3">La Revista Nacional de las Ciencias para Estudiantes es una publicación interdisciplinaria revisada por pares, escrita, editada y curada por estudiantes y profesores, escolares y universitarios. Está abierta a todo el mundo, aunque fomenta especialmente la participación de chilenos. Su objetivo es fomentar el pensamiento crítico y la investigación científica entre jóvenes, mediante un sistema de publicación serio, accesible y riguroso.</p>
  <p class="text-sm sm:text-base"><em>No está asociada a ninguna institución, programa ni colegio en particular. Es una iniciativa independiente, abierta a todos los estudiantes. No hay ningún costo, es completamente gratuita y opera gracias al compromiso de nuestros colaboradores.</em></p>
</div>
    `.trim();
  } else {
    return `
<div class="about-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Who We Are</h2>
  <p class="text-sm sm:text-base mb-2 sm:mb-3">The National Review of Sciences for Students is an interdisciplinary peer-reviewed publication, written, edited, and curated by students and teachers, at school and university levels. It is open to everyone in the world, although it especially encourages participation from Chileans. Its objective is to foster critical thinking and scientific research among young people, through a serious, accessible, and rigorous publication system.</p>
  <p class="text-sm sm:text-base"><em>It is not associated with any institution, program, or school in particular. It is an independent initiative, open to all students. There is no cost, it is completely free and operates thanks to the commitment of our collaborators.</em></p>
</div>
    `.trim();
  }
}

function getGuidelinesContent(lang) {
  if (lang === 'es') {
    return `
<div class="guidelines-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Normas Editoriales</h2>
  <ul class="list-disc pl-4 sm:pl-5 text-sm sm:text-base">
    <li class="mb-2 sm:mb-3">Extensión: 1.000–10.000 palabras (tablas no cuentan como palabras)</li>
    <li class="mb-2 sm:mb-3">Formato: Word (.docx), sin nombre del autor en el documento</li>
    <li class="mb-2 sm:mb-3">Originalidad: El artículo debe ser inédito, no publicado ni enviado a otro medio, y no puede usar IA para redactar</li>
    <li class="mb-2 sm:mb-3">Citación: Exclusivamente <a href="https://www.chicagomanualofstyle.org/tools_citationguide.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">estilo Chicago</a></li>
    <li class="mb-2 sm:mb-3">Aceptamos artículos en español y en inglés</li>
    <li class="mb-2 sm:mb-3">Elementos permitidos: Gráficas, ecuaciones, imágenes, tablas (fuera del conteo de palabras)</li>
  </ul>
  <h3 class="text-lg sm:text-xl font-semibold mt-6 mb-3">Para aprender a hacer un artículo científico, te recomendamos los siguientes videos:</h3>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <iframe width="100%" height="200" src="https://www.youtube.com/embed/wyPhAGWGW6-94" title="Video 1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    <iframe width="100%" height="200" src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" title="Playlist" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
  </div>
  <h3 class="text-lg sm:text-xl font-semibold mt-8 mb-4">Para investigar, te recomendamos los siguientes sitios:</h3>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <a href="https://scholar.google.com/" target="_blank" rel="noopener noreferrer" class="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition">
      <h4 class="text-base sm:text-lg font-semibold text-gray-800 mb-2">Google Scholar</h4>
      <p class="text-sm text-gray-600">Buscador académico de Google con millones de artículos científicos.</p>
    </a>
    <a href="https://scielo.org/es/" target="_blank" rel="noopener noreferrer" class="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition">
      <h4 class="text-base sm:text-lg font-semibold text-gray-800 mb-2">SciELO</h4>
      <p class="text-sm text-gray-600">Biblioteca científica en línea de acceso abierto en español y portugués.</p>
    </a>
    <a href="https://consensus.app/" target="_blank" rel="noopener noreferrer" class="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition">
      <h4 class="text-base sm:text-lg font-semibold text-gray-800 mb-2">Consensus</h4>
      <p class="text-sm text-gray-600">Plataforma impulsada por IA para encontrar y resumir artículos científicos.</p>
    </a>
  </div>
</div>
    `.trim();
  } else {
    return `
<div class="guidelines-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Editorial Guidelines</h2>
  <ul class="list-disc pl-4 sm:pl-5 text-sm sm:text-base">
    <li class="mb-2 sm:mb-3">Length: 1,000–10,000 words (tables do not count as words)</li>
    <li class="mb-2 sm:mb-3">Format: Word (.docx), without the author's name in the document</li>
    <li class="mb-2 sm:mb-3">Originality: The article must be unpublished, not published or sent to another medium, and cannot use AI for drafting</li>
    <li class="mb-2 sm:mb-3">Citation: Exclusively <a href="https://www.chicagomanualofstyle.org/tools_citationguide.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">Chicago style</a></li>
    <li class="mb-2 sm:mb-3">We accept articles in Spanish and English</li>
    <li class="mb-2 sm:mb-3">Allowed elements: Graphs, equations, images, tables (outside the word count)</li>
  </ul>
  <h3 class="text-lg sm:text-xl font-semibold mt-6 mb-3">To learn how to make a scientific article, we recommend the following videos:</h3>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <iframe width="100%" height="200" src="https://www.youtube.com/embed/wyPhAGWGW6-94" title="Video 1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    <iframe width="100%" height="200" src="https://www.youtube.com/embed/videoseries?list=PL8yQlmhs7KsBerg9X63QnZnlNAopwzDmw" title="Playlist" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
  </div>
  <h3 class="text-lg sm:text-xl font-semibold mt-8 mb-4">For research, we recommend the following sites:</h3>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <a href="https://scholar.google.com/" target="_blank" rel="noopener noreferrer" class="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition">
      <h4 class="text-base sm:text-lg font-semibold text-gray-800 mb-2">Google Scholar</h4>
      <p class="text-sm text-gray-600">Google's academic search engine with millions of scientific articles.</p>
    </a>
    <a href="https://scielo.org/es/" target="_blank" rel="noopener noreferrer" class="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition">
      <h4 class="text-base sm:text-lg font-semibold text-gray-800 mb-2">SciELO</h4>
      <p class="text-sm text-gray-600">Online scientific library with open access in Spanish and Portuguese.</p>
    </a>
    <a href="https://consensus.app/" target="_blank" rel="noopener noreferrer" class="block p-4 bg-gray-50 rounded-xl shadow hover:shadow-md transition">
      <h4 class="text-base sm:text-lg font-semibold text-gray-800 mb-2">Consensus</h4>
      <p class="text-sm text-gray-600">AI-powered platform to find and summarize scientific articles.</p>
    </a>
  </div>
</div>
    `.trim();
  }
}

function getFaqContent(lang) {
  if (lang === 'es') {
    return `
<div class="faq-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Preguntas Frecuentes</h2>
  <ul class="list-disc pl-4 sm:pl-5 text-sm sm:text-base">
    <li class="mb-2 sm:mb-3"><strong>¿Quién puede publicar?</strong> Cualquier estudiante escolar o universitario del mundo.</li>
    <li class="mb-2 sm:mb-3"><strong>¿Se puede usar IA para ayudme a escribir?</strong> No. Será rechazado automáticamente.</li>
    <li class="mb-2 sm:mb-3"><strong>¿Cuánto se demoran en responder?</strong> Entre 1 y 3 semanas, dependiendo del volumen de solicitudes.</li>
    <li class="mb-2 sm:mb-3"><strong>¿Cómo se revisa un artículo?</strong> Revisión ciega, sin nombre del autor. Hay alumnos y profesores que revisarán tu artículo según tu área.</li>
    <li class="mb-2 sm:mb-3"><strong>¿En qué formato envío el artículo?</strong> Word (.docx), estilo Chicago, 2.000–10.000 palabras.</li>
    <li class="mb-2 sm:mb-3"><strong>¿Cómo puedo postular como administrador?</strong> Desde la pestaña Postula como administrador.</li>
  </ul>
</div>
    `.trim();
  } else {
    return `
<div class="faq-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Frequently Asked Questions</h2>
  <ul class="list-disc pl-4 sm:pl-5 text-sm sm:text-base">
    <li class="mb-2 sm:mb-3"><strong>Who can publish?</strong> Any school or university student in the world.</li>
    <li class="mb-2 sm:mb-3"><strong>Can I use AI to help me write?</strong> No. It will be automatically rejected.</li>
    <li class="mb-2 sm:mb-3"><strong>How long does it take to respond?</strong> Between 1 and 3 weeks, depending on the volume of requests.</li>
    <li class="mb-2 sm:mb-3"><strong>How is an article reviewed?</strong> Blind review, without the author's name. There are students and teachers who will review your article according to your area.</li>
    <li class="mb-2 sm:mb-3"><strong>In what format do I send the article?</strong> Word (.docx), Chicago style, 2,000–10,000 words.</li>
    <li class="mb-2 sm:mb-3"><strong>How can I apply as an administrator?</strong> From the Apply as administrator tab.</li>
  </ul>
</div>
    `.trim();
  }
}

function getSubmitContent(lang) {
  if (lang === 'es') {
    return `
<div class="submit-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Enviar un Artículo</h2>
  <p class="text-sm sm:text-base mb-3 sm:mb-4"><strong>Importante: No incluyas tu nombre directamente en el documento</strong> - solo en el formulario de abajo.</p>
  <div class="relative w-full h-96 sm:h-[600px]">
    <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSf3oTgTOurPOKTmUeBMYxq1XtVLHkI6R0l9CoqFmMyLOlEefg/viewform?embedded=true" class="w-full h-full" frameborder="0" marginheight="0" marginwidth="0">Cargando...</iframe>
  </div>
</div>
    `.trim();
  } else {
    return `
<div class="submit-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
  <h2 class="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Submit an Article</h2>
  <p class="text-sm sm:text-base mb-3 sm:mb-4"><strong>Important: Do not include your name directly in the document</strong> - only in the form below.</p>
  <div class="relative w-full h-96 sm:h-[600px]">
    <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSf3oTgTOurPOKTmUeBMYxq1XtVLHkI6R0l9CoqFmMyLOlEefg/viewform?embedded=true" class="w-full h-full" frameborder="0" marginheight="0" marginwidth="0">Loading...</iframe>
  </div>
</div>
    `.trim();
  }
}

function getAdminContent(lang) {
  const roles = lang === 'es' ? [
    {
      name: 'Fundador',
      description: 'Persona que inició el proyecto, definiendo su visión y objetivos iniciales. Supervisa la dirección estratégica de la revista.',
      isPostulable: false,
    },
    {
      name: 'Co-Fundador',
      description: 'Colaborador clave en la fundación del proyecto, apoya al Fundador en la toma de decisiones estratégicas.',
      isPostulable: false,
    },
    {
      name: 'Director General',
      description: 'Encargado de la visión general, coordinación del equipo, relaciones externas y supervisión global de la revista.',
      isPostulable: false,
    },
    {
      name: 'Subdirector General',
      description: 'Asiste al Director General en decisiones estratégicas y asume la dirección en su ausencia.',
      isPostulable: false,
    },
    {
      name: 'Editor en Jefe',
      description: 'Supervisa todos los contenidos y coordina al equipo editorial. Garantiza la calidad de los artículos.',
      isPostulable: true,
    },
    {
      name: 'Editor de Sección',
      description: 'Revisa y edita textos de una sección específica (por ejemplo, Opinión, Cultura, Actualidad). Vota por publicar o no un trabajo',
      isPostulable: true,
    },
    {
      name: 'Revisor / Comité Editorial',
      description: 'Corrige estilo, ortografía y coherencia de los artículos. Proporciona retroalimentación a los autores.',
      isPostulable: true,
    },
    {
      name: 'Responsable de Desarrollo Web',
      description: 'Administra el sitio web, corrige errores técnicos y implementa mejoras de diseño y funcionalidad.',
      isPostulable: false,
    },
    {
      name: 'Encargado de Soporte Técnico',
      description: 'Resuelve problemas técnicos relacionados con la carga de contenidos, formularios y correos.',
      isPostulable: true,
    },
    {
      name: 'Encargado/a de Redes Sociales',
      description: 'Gestiona las redes sociales (Instagram, X, TikTok, etc.), publica contenido y promueve la revista.',
      isPostulable: false,
    },
    {
      name: 'Diseñador/a Gráfico/a',
      description: 'Crea material visual como afiches, portadas y plantillas para redes sociales.',
      isPostulable: true,
    },
    {
      name: 'Community Manager',
      description: 'Interactúa con la comunidad, responde mensajes y fomenta la participación en las plataformas de la revista.',
      isPostulable: true,
    },
    {
      name: 'Encargado/a de Recepción de Artículos',
      description: 'Recibe, organiza y canaliza las postulaciones de artículos hacia los revisores.',
      isPostulable: true,
    },
    {
      name: 'Encargado/a de Nuevos Colaboradores',
      description: 'Orienta a nuevos postulantes a roles administrativos, revisores o editores.',
      isPostulable: true,
    },
    {
      name: 'Coordinador/a de Eventos o Convocatorias',
      description: 'Organiza conversatorios, debates, concursos u otras actividades para promover la revista.',
      isPostulable: true,
    },
    {
      name: 'Asesor/a Legal/Editorial',
      description: 'Revisa términos legales, normas editoriales y derechos de autor para la revista (NO NECESARIO POR EL MOMENTO).',
      isPostulable: true,
    },
    {
      name: 'Responsable de Finanzas / Transparencia',
      description: 'Gestiona donaciones o presupuestos, asegurando transparencia en las finanzas (NO NECESARIO POR EL MOMENTO).',
      isPostulable: true,
    },
  ] : [
    {
      name: 'Founder',
      description: 'Person who started the project, defining its vision and initial objectives. Oversees the strategic direction of the review.',
      isPostulable: false,
    },
    {
      name: 'Co-Founder',
      description: 'Key collaborator in the foundation of the project, supports the Founder in strategic decision-making.',
      isPostulable: false,
    },
    {
      name: 'General Director',
      description: 'In charge of the overall vision, team coordination, external relations, and overall supervision of the review.',
      isPostulable: false,
    },
    {
      name: 'Deputy General Director',
      description: 'Assists the General Director in strategic decisions and assumes direction in their absence.',
      isPostulable: false,
    },
    {
      name: 'Editor in Chief',
      description: 'Oversees all contents and coordinates the editorial team. Ensures the quality of the articles.',
      isPostulable: true,
    },
    {
      name: 'Section Editor',
      description: 'Reviews and edits texts from a specific section (e.g., Opinion, Culture, Current Affairs). Votes to publish or not a work.',
      isPostulable: true,
    },
    {
      name: 'Reviewer / Editorial Committee',
      description: 'Corrects style, spelling, and coherence of the articles. Provides feedback to the authors.',
      isPostulable: true,
    },
    {
      name: 'Web Development Manager',
      description: 'Manages the website, corrects technical errors, and implements design and functionality improvements.',
      isPostulable: false,
    },
    {
      name: 'Technical Support Manager',
      description: 'Resolves technical problems related to content loading, forms, and emails.',
      isPostulable: true,
    },
    {
      name: 'Social Media Manager',
      description: 'Manages social networks (Instagram, X, TikTok, etc.), publishes content, and promotes the review.',
      isPostulable: false,
    },
    {
      name: 'Graphic Designer',
      description: 'Creates visual material such as posters, covers, and templates for social networks.',
      isPostulable: true,
    },
    {
      name: 'Community Manager',
      description: 'Interacts with the community, responds to messages, and encourages participation in the review\'s platforms.',
      isPostulable: true,
    },
    {
      name: 'Article Reception Manager',
      description: 'Receives, organizes, and channels article applications to the reviewers.',
      isPostulable: true,
    },
    {
      name: 'New Collaborators Manager',
      description: 'Guides new applicants to administrative roles, reviewers, or editors.',
      isPostulable: true,
    },
    {
      name: 'Events or Calls Coordinator',
      description: 'Organizes talks, debates, contests, or other activities to promote the review.',
      isPostulable: true,
    },
    {
      name: 'Legal/Editorial Advisor',
      description: 'Reviews legal terms, editorial standards, and copyright for the review (NOT NECESSARY AT THE MOMENT).',
      isPostulable: true,
    },
    {
      name: 'Finance / Transparency Manager',
      description: 'Manages donations or budgets, ensuring transparency in finances (NOT NECESSARY AT THE MOMENT).',
      isPostulable: true,
    },
  ];

  const heading = lang === 'es' ? 'Únete a nuestro equipo' : 'Join our team';
  const p = lang === 'es' ? 'Forma parte de la Revista Nacional de las Ciencias para Estudiantes. Contribuye con tu talento a la divulgación científica y apoya a estudiantes en su camino hacia la investigación. Selecciona un rol para conocer sus funciones o postula a los cargos disponibles.' : 'Become part of The National Review of Sciences for Students. Contribute with your talent to scientific dissemination and support students in their path to research. Select a role to learn about its functions or apply to the available positions.';

  const rolesGrid = roles.map(role => `
<div class="p-3 sm:p-4 rounded-lg shadow-sm transition-shadow ${role.isPostulable ? 'bg-green-50 hover:shadow-md' : 'bg-gray-100 cursor-not-allowed'}">
  <p class="text-sm sm:text-lg font-semibold ${role.isPostulable ? 'text-green-600 cursor-pointer hover:underline' : 'text-gray-500'}">${role.name}</p>
  <p class="text-xs sm:text-base text-gray-600">${role.isPostulable ? 'Cargo postulable' : 'Cargo definido'}</p>
  <p class="text-xs sm:text-base text-gray-600 mt-2">${role.description}</p>
  ${role.isPostulable ? '<a href="https://docs.google.com/forms/d/e/1FAIpQLSc7qqwQCnKSxr2Ix1uYrfMnDY5uvV64WUzATAP63ax71vfFNg/viewform" target="_blank" class="mt-2 block bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 text-sm min-h-10 sm:text-base">Postular</a>' : ''}
</div>
  `).join('');

  return `
<div class="admin-section bg-white p-3 sm:p-6 rounded-lg shadow-md mt-3 sm:mt-6">
  <h2 class="text-lg sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-600 text-center">${heading}</h2>
  <p class="text-sm sm:text-base text-gray-600 mb-3 sm:mb-6 text-center max-w-2xl mx-auto">${p}</p>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-3 sm:mb-8">
    ${rolesGrid}
  </div>
</div>
  `.trim();
}

function formatDateNews(dateStr) {
  if (!dateStr) return lang === 'es' ? 'Sin fecha' : 'No date';
  let date = new Date(dateStr);
  if (!isNaN(date)) return date.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dateStr.split(/[\/.-]/);
  if (parts.length === 3) {
    let [day, month, year] = parts.map(p => p.padStart(2, '0'));
    if (year.length === 2) year = '20' + year;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date)) return date.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return dateStr;
}

function decodeBodyToHtml(body, truncate = false, lang) {
  if (!body) return '<p class="text-[#000000]">No content available.</p>';
  let fullBody = body;
  if (truncate && body.length > 2000) {
    const paragraphs = String(body).split("===");
    let charCount = 0;
    let truncatedParagraphs = [];
    for (let i = 0; i < paragraphs.length; i++) {
      charCount += paragraphs[i].length + 3;
      if (charCount <= 2000) {
        truncatedParagraphs.push(paragraphs[i]);
      } else {
        break;
      }
    }
    fullBody = truncatedParagraphs.join("===") + (truncatedParagraphs.length < paragraphs.length ? "..." : "");
  }
  const paragraphs = String(fullBody).split("===").filter(p => p.trim() !== "");
  let content = [];
  let i = 0;
  while (i < paragraphs.length) {
    let p = paragraphs[i].trim();
    if (/^ - /.test(p)) { // Note: changed from '- ' to ' - ' if space
      const items = [];
      while (i < paragraphs.length && paragraphs[i].trim().startsWith('- ')) {
        const itemText = paragraphs[i].trim().slice(2);
        items.push(renderParagraphToHtml(itemText));
        i++;
      }
      content.push(`<ul class="mb-4 list-disc pl-6">${items.map(item => `<li>${item}</li>`).join('')}</ul>`);
      continue;
    } else if (/^\d+\.\s/.test(p)) {
      const items = [];
      while (i < paragraphs.length && /^\d+\.\s/.test(paragraphs[i].trim())) {
        const itemText = paragraphs[i].trim().replace(/^\d+\.\s/, '');
        items.push(renderParagraphToHtml(itemText));
        i++;
      }
      content.push(`<ol class="mb-4 list-decimal pl-6">${items.map(item => `<li>${item}</li>`).join('')}</ol>`);
      continue;
    } else {
      content.push(`<div class="mb-4 leading-relaxed break-words" style="clear: both;">${renderParagraphToHtml(p)}</div>`);
      i++;
    }
  }
  return content.join('');
}

function renderParagraphToHtml(p) {
  let text = p.trim();
  const placeholders = [];
  const TOK = (i) => `__TOK${i}__`;

  let align = "left";
  let size = "normal";
  if (text.startsWith('(')) {
    const endIdx = text.indexOf(')');
    if (endIdx !== -1) {
      const paramStr = text.slice(1, endIdx);
      const params = paramStr.split(',').map(p => p.trim());
      params.forEach(p => {
        if (['small', 'big', 'normal'].includes(p)) size = p;
        if (['left', 'center', 'right', 'justify'].includes(p)) align = p;
      });
      text = text.slice(endIdx + 1).trim();
    }
  }

  const imgPattern = /\[img:([^\]]*?)(?:,(\d*(?:px|% )?|auto))?(?:,(\d*(?:px|% )?|auto))?(?:,(left|center|right|justify))?\]/gi;
  text = text.replace(imgPattern, (_, url, width = "auto", height = "auto", imgAlign = "left") => {
    if (width !== "auto" && width && !width.match(/%|px$/)) width += 'px';
    if (height !== "auto" && height && !height.match(/%|px$/)) height += 'px';
    const id = placeholders.length;
    placeholders.push({ type: "image", url: normalizeUrl(url), width, height, align: imgAlign });
    return TOK(id);
  });

  const linkPattern = /\b([^\s(]+)\((https?:\/\/[^\s)]+)\)/gi;
  text = text.replace(linkPattern, (_, word, url) => {
    const id = placeholders.length;
    placeholders.push({ type: "link", word, url });
    return TOK(id);
  });

  const urlPattern = /(?:https?:\/\/[^\s)]+|^data:image\/[a-zA-Z+]+;base64,[^\s)]+)/gi;
  text = text.replace(urlPattern, (u) => {
    if (placeholders.some(ph => ph.url === u)) return u;
    const id = placeholders.length;
    placeholders.push({ type: isLikelyImageUrl(u) ? "image" : "url", url: u });
    return TOK(id);
  });

  text = text.replace(/\[size:([^\]]+)\](.*?)\[\/size\]/gs, (_, sz, content) => {
    const id = placeholders.length;
    placeholders.push({ type: "size", size: sz, content });
    return TOK(id);
  });

  text = text.replace(/<<ESC_(\d+)>>/g, (_, code) => String.fromCharCode(Number(code)));

  const styledContent = renderStyledTextToHtml(text, placeholders);

  let fontSizeStyle = '';
  if (size === 'small') fontSizeStyle = 'font-size: 0.75em;';
  else if (size === 'big') fontSizeStyle = 'font-size: 1.5em;';
  else fontSizeStyle = 'font-size: inherit;';

  const alignStyle = `text-align: ${align}; ${fontSizeStyle} width: 100%; display: block; margin: ${align === 'center' ? '0 auto' : '0'};`;

  return `<div style="${alignStyle}">${styledContent}</div>`;
}

function renderStyledTextToHtml(text, placeholders) {
  text = text.replace(/\\([*/_$~])/g, (_, char) => `<<ESC_${char.charCodeAt(0)}>>`);

  const parts = text.split(/(__TOK\d+__)/g);
  let out = [];
  let buf = "";
  let bold = false;
  let italic = false;
  let underline = false;
  let strike = false;

  for (const part of parts) {
    if (/^__TOK\d+__$/.test(part)) {
      if (buf) {
        let style = '';
        if (bold) style += 'font-weight: bold;';
        if (italic) style += 'font-style: italic;';
        if (underline || strike) {
          style += 'text-decoration: ' + (underline ? 'underline ' : '') + (strike ? 'line-through' : '') + ';';
        }
        out.push(`<span style="${style.trim()}">${buf}</span>`);
        buf = "";
      }
      const idx = Number(part.match(/\d+/)[0]);
      const ph = placeholders[idx];
      if (!ph) continue;
      if (ph.type === "link") {
        out.push(`<a href="${normalizeUrl(ph.url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${ph.word}</a>`);
      } else if (ph.type === "image") {
        let imgStyle = 'width: ' + (ph.width !== 'auto' ? ph.width : '100%') + '; height: ' + (ph.height !== 'auto' ? ph.height : 'auto') + '; display: block; margin-left: ' + (ph.align === 'center' ? 'auto' : '0') + '; margin-right: ' + (ph.align === 'center' ? 'auto' : '0') + '; float: ' + (ph.align === 'left' || ph.align === 'right' ? ph.align : 'none') + '; max-width: 100%; margin-top: 8px; margin-bottom: 8px;';
        if (ph.align === 'justify') {
          imgStyle = 'width: 100%; margin-left: 0; margin-right: 0; float: none;';
        }
        out.push(`<img src="${normalizeUrl(ph.url)}" alt="Image" class="max-w-full h-auto rounded-md" style="${imgStyle}">`);
      } else if (ph.type === "url") {
        out.push(`<a href="${normalizeUrl(ph.url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${ph.url}</a>`);
      } else if (ph.type === "size") {
        let fontSizeStyle = '';
        if (ph.size === 'small') fontSizeStyle = 'font-size: 0.75em;';
        else if (ph.size === 'big') fontSizeStyle = 'font-size: 1.5em;';
        else fontSizeStyle = 'font-size: inherit;';
        out.push(`<span style="${fontSizeStyle}">${renderStyledTextToHtml(ph.content, placeholders)}</span>`);
      }
      continue;
    }
    for (const ch of part) {
      if (ch === "*") {
        if (buf) {
          let style = '';
          if (bold) style += 'font-weight: bold;';
          if (italic) style += 'font-style: italic;';
          if (underline || strike) {
            style += 'text-decoration: ' + (underline ? 'underline ' : '') + (strike ? 'line-through' : '') + ';';
          }
          out.push(`<span style="${style.trim()}">${buf}</span>`);
          buf = "";
        }
        bold = !bold;
      } else if (ch === "/") {
        if (buf) {
          let style = '';
          if (bold) style += 'font-weight: bold;';
          if (italic) style += 'font-style: italic;';
          if (underline || strike) {
            style += 'text-decoration: ' + (underline ? 'underline ' : '') + (strike ? 'line-through' : '') + ';';
          }
          out.push(`<span style="${style.trim()}">${buf}</span>`);
          buf = "";
        }
        italic = !italic;
      } else if (ch === "$") {
        if (buf) {
          let style = '';
          if (bold) style += 'font-weight: bold;';
          if (italic) style += 'font-style: italic;';
          if (underline || strike) {
            style += 'text-decoration: ' + (underline ? 'underline ' : '') + (strike ? 'line-through' : '') + ';';
          }
          out.push(`<span style="${style.trim()}">${buf}</span>`);
          buf = "";
        }
        underline = !underline;
      } else if (ch === "~") {
        if (buf) {
          let style = '';
          if (bold) style += 'font-weight: bold;';
          if (italic) style += 'font-style: italic;';
          if (underline || strike) {
            style += 'text-decoration: ' + (underline ? 'underline ' : '') + (strike ? 'line-through' : '') + ';';
          }
          out.push(`<span style="${style.trim()}">${buf}</span>`);
          buf = "";
        }
        strike = !strike;
      } else {
        buf += ch;
      }
    }
  }
  if (buf) {
    let style = '';
    if (bold) style += 'font-weight: bold;';
    if (italic) style += 'font-style: italic;';
    if (underline || strike) {
      style += 'text-decoration: ' + (underline ? 'underline ' : '') + (strike ? 'line-through' : '') + ';';
    }
    out.push(`<span style="${style.trim()}">${buf}</span>`);
  }
  return out.join('');
}

function normalizeUrl(u) {
  let url = (u || "").trim();
  if (/^https?:[^/]/i.test(url)) {
    url = url.replace(/^https?:/i, (m) => m + "//");
  }
  return url;
}

function getNewsContent(lang, newsData) {
  const heading = lang === 'es' ? 'Noticias' : 'News';
  const searchPlaceholder = lang === 'es' ? 'Buscar noticias...' : 'Search news...';
  const loadingText = lang === 'es' ? 'Cargando noticias...' : 'Loading news...';
  const noNews = lang === 'es' ? 'No se encontraron noticias.' : 'No news found.';
  const loadMore = lang === 'es' ? 'Ver más' : 'View more';

  const newsGrid = newsData.map((item) => `
<div class="bg-white p-5 rounded-2xl shadow-lg flex flex-col border border-gray-100 hover:shadow-xl transition">
  <h4 class="text-lg font-semibold text-[#5a3e36] mb-2 leading-snug">${item['Título'] || 'Sin título'}</h4>
  <p class="text-sm text-gray-500 mb-3 italic">${formatDateNews(item['Fecha'])}</p>
  <div class="text-[#000000] text-sm leading-relaxed">
    ${decodeBodyToHtml(item['Contenido de la noticia'], true, lang)}
  </div>
</div>
  `).join('');

  return `
<div class="space-y-6 bg-[#f4ece7] p-6 rounded-lg shadow-md">
  <h3 class="text-2xl font-semibold text-[#5a3e36]">${heading}</h3>
  <input type="text" placeholder="${searchPlaceholder}" class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#5a3e36] bg-white text-[#000000]">
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    ${newsGrid}
  </div>
  <!-- Load more button if needed -->
</div>
  `.trim();
}

if (!fs.existsSync(outputHtmlDir)) fs.mkdirSync(outputHtmlDir, { recursive: true });
if (!fs.existsSync(teamOutputHtmlDir)) fs.mkdirSync(teamOutputHtmlDir, { recursive: true });
if (!fs.existsSync(sectionsOutputDir)) fs.mkdirSync(sectionsOutputDir, { recursive: true });

(async () => {
  try {
    // Procesar artículos
    const articlesRes = await fetch(articlesCsvUrl);
    if (!articlesRes.ok) throw new Error(`Error descargando CSV de artículos: ${articlesRes.statusText}`);
    const articlesCsvData = await articlesRes.text();
    const articlesParsed = Papa.parse(articlesCsvData, { header: true, skipEmptyLines: true });
    const articles = articlesParsed.data.map(row => ({
      titulo: row['Título'] || 'Sin título',
      titulo_en: row['Title (English)'] || row['Título'] || 'No title',
      autores: row['Autor(es)'] || 'Autor desconocido',
      autores_en: row['Author(s) (English)'] || row['Autor(es)'] || 'Unknown author',
      resumen: row['Resumen'] || 'Resumen no disponible',
      englishAbstract: row['Abstract'] || 'English abstract not available',
      pdf: `${domain}/Articles/Articulo${row['Número de artículo']}.pdf`,
      fecha: parseDateFlexible(row['Fecha']),
      volumen: row['Volumen'] || '',
      numero: row['Número'] || '',
      primeraPagina: row['Primera página'] || '',
      ultimaPagina: row['Última página'] || '',
      area: row['Área temática'] || '',
      area_en: row['Thematic Area (English)'] || row['Área temática'] || '',
      numeroArticulo: row['Número de artículo'] || '',
      palabras_clave: row['Palabras clave']
        ? row['Palabras clave'].split(/[;,]/).map(k => k.trim())
        : [],
      palabras_clave_en: row['Keywords (English)'] 
        ? row['Keywords (English)'].split(/[;,]/).map(k => k.trim())
        : [],
    }));
    fs.writeFileSync(outputJson, JSON.stringify(articles, null, 2), 'utf8');
    console.log(`✅ Archivo generado: ${outputJson} (${articles.length} artículos)`);

    // Generar páginas de artículos en es e en
    for (const lang of ['es', 'en']) {
      const articlesDir = path.join(outputHtmlDir, lang);
      if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });

      articles.forEach(article => {
        const authors = lang === 'es' ? article.autores : article.autores_en;
        const title = lang === 'es' ? article.titulo : article.titulo_en;
        const abstract = lang === 'es' ? article.resumen : article.englishAbstract;
        const abstractOther = lang === 'es' ? article.englishAbstract : article.resumen;
        const keywords = lang === 'es' ? article.palabras_clave.join('; ') : article.palabras_clave_en.join('; ');
        const area = lang === 'es' ? article.area : article.area_en;
        const journal = lang === 'es' ? journalEs : journalEn;
        const publicationDate = lang === 'es' ? 'Fecha de publicación' : 'Publication Date';
        const thematicArea = lang === 'es' ? 'Área temática' : 'Thematic Area';
        const summary = lang === 'es' ? 'Resumen' : 'Abstract';
        const abstractLabel = lang === 'es' ? 'Abstract (English)' : 'Resumen (Spanish)';
        const downloadPdf = lang === 'es' ? 'Descargar PDF' : 'Download PDF';
        const citations = lang === 'es' ? 'Citas' : 'Citations';
        const year = new Date(article.fecha).getFullYear();
        const apa = lang === 'es' ? 'APA' : 'APA';
        const mla = lang === 'es' ? 'MLA' : 'MLA';
        const chicago = lang === 'es' ? 'Chicago' : 'Chicago';

        const authorsList = authors.split(';').map(a => formatAuthorForCitation(a));
        const authorMetaTags = authorsList.map(author => `<meta name="citation_author" content="${author}">`).join('\n');

        const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${title}">
  ${authorMetaTags}
  <meta name="citation_publication_date" content="${article.fecha}">
  <meta name="citation_journal_title" content="${journal}">
  <meta name="citation_issn" content="1234-5678">
  <meta name="citation_volume" content="${article.volumen}">
  <meta name="citation_issue" content="${article.numero}">
  <meta name="citation_firstpage" content="${article.primeraPagina}">
  <meta name="citation_lastpage" content="${article.ultimaPagina}">
  <meta name="citation_pdf_url" content="${article.pdf}">
  <meta name="citation_abstract_html_url" content="${domain}/articles/${lang}/articulo${article.numeroArticulo}.html">
  <meta name="citation_abstract" content="${abstract}">
  <meta name="citation_abstract" xml:lang="${lang === 'es' ? 'en' : 'es'}" content="${abstractOther}">
  <meta name="citation_keywords" content="${keywords}">
  <meta name="citation_language" content="${lang}">
  <link rel="alternate" hreflang="${lang === 'es' ? 'en' : 'es'}" href="${domain}/articles/${lang === 'es' ? 'en' : 'es'}/articulo${article.numeroArticulo}.html">
  <title>${title} - ${journal}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  ${generateHeader(lang)}
  <main>
    <header>
      <h1>${title}</h1>
      <h3>${authors}</h3>
      <p><strong>${publicationDate}:</strong> ${article.fecha}</p>
      <p><strong>${thematicArea}:</strong> ${area}</p>
    </header>
    <section>
      <h2>${summary}</h2>
      <p>${abstract}</p>
    </section>
    <section>
      <h2>${abstractLabel}</h2>
      <p>${abstractOther}</p>
    </section>
    <section>
      <h2>${downloadPdf}</h2>
      <a href="${article.pdf}" target="_blank" download>${downloadPdf}</a>
    </section>
    <section>
      <h2>${citations}</h2>
      <p><strong>${apa}:</strong> ${authors}. (${year}). ${title}. <em>${journal}</em>, ${article.volumen}(${article.numero}), ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>${mla}:</strong> ${authors}. "${title}." <em>${journal}</em>, vol. ${article.volumen}, no. ${article.numero}, ${year}, pp. ${article.primeraPagina}-${article.ultimaPagina}.</p>
      <p><strong>${chicago}:</strong> ${authors}. "${title}." <em>${journal}</em> ${article.volumen}, no. ${article.numero} (${year}): ${article.primeraPagina}-${article.ultimaPagina}.</p>
    </section>
  </main>
  ${generateFooter(lang)}
</body>
</html>
        `.trim();
        const filePath = path.join(articlesDir, `articulo${article.numeroArticulo}.html`);
        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`Generado HTML de artículo (${lang}): ${filePath}`);
      });

      // Generar índice de artículos para el lang
      const articlesByYear = articles.reduce((acc, article) => {
        const year = new Date(article.fecha).getFullYear() || (lang === 'es' ? 'Sin fecha' : 'No date');
        if (!acc[year]) acc[year] = [];
        acc[year].push(article);
        return acc;
      }, {});

      const indexHeading = lang === 'es' ? 'Índice de Artículos por Año' : 'Index of Articles by Year';
      const indexP = lang === 'es' ? 'Accede a los artículos por año de publicación. Cada enlace lleva a la página del artículo con resumen y PDF.' : 'Access articles by year of publication. Each link leads to the article page with abstract and PDF.';
      const yearHeading = lang === 'es' ? 'Año ' : 'Year ';
      const volNum = lang === 'es' ? ' (Vol. ' : ' (Vol. ';
      const num = lang === 'es' ? ', Núm. ' : ', No. ';
      const footerP = lang === 'es' ? '&copy; ' + new Date().getFullYear() + ' Revista Nacional de las Ciencias para Estudiantes' : '&copy; ' + new Date().getFullYear() + ' The National Review of Sciences for Students';
      const backLink = lang === 'es' ? 'Volver al inicio' : 'Back to home';

      let indexContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${indexHeading} - ${lang === 'es' ? journalEs : journalEn}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  ${generateHeader(lang)}
  <header>
    <h1>${indexHeading}</h1>
    <p>${indexP}</p>
  </header>
  <main>
${Object.keys(articlesByYear).sort().reverse().map(year => `
    <section>
      <h2>${yearHeading}${year}</h2>
      <ul>
        ${articlesByYear[year].map(article => `
          <li>
            <a href="/articles/${lang}/articulo${article.numeroArticulo}.html">${lang === 'es' ? article.titulo : article.titulo_en}</a> - ${lang === 'es' ? article.autores : article.autores_en}${volNum}${article.volumen}${num}${article.numero})
          </li>
        `).join('')}
      </ul>
    </section>
`).join('')}
  </main>
  <footer>
    <p>${footerP}</p>
    <a href="/">${backLink}</a>
  </footer>
</body>
</html>
    `.trim();
      const indexPath = path.join(articlesDir, 'index.html');
      fs.writeFileSync(indexPath, indexContent, 'utf8');
      console.log(`Generado índice HTML de artículos (${lang}): ${indexPath}`);
    }

    // Procesar equipo
    const teamRes = await fetch(teamCsvUrl);
    if (!teamRes.ok) throw new Error(`Error descargando CSV de equipo: ${teamRes.statusText}`);
    const teamCsvData = await teamRes.text();
    const teamParsed = Papa.parse(teamCsvData, { header: true, skipEmptyLines: true });
    const filteredMembers = teamParsed.data.filter((data) => {
      const memberRoles = (data['Rol en la Revista'] || '')
        .split(';')
        .map((role) => role.trim())
        .filter((role) => role);
      return !(memberRoles.length === 1 && memberRoles[0] === 'Autor');
    });

    for (const lang of ['es', 'en']) {
      const teamDir = path.join(teamOutputHtmlDir, lang);
      if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });

      filteredMembers.forEach(member => {
        const nombre = lang === 'es' ? member['Nombre'] || 'Miembro desconocido' : member['Name (English)'] || member['Nombre'] || 'Unknown Member';
        const slug = generateSlug(nombre);
        const roles = lang === 'es' ? (member['Rol en la Revista'] || 'No especificado')
          .split(';')
          .map(r => r.trim())
          .filter(r => r)
          .join(', ') || 'No especificado' : (member['Role in the Journal (English)'] || 'Not specified')
          .split(';')
          .map(r => r.trim())
          .filter(r => r)
          .join(', ') || 'Not specified';
        const descripcion = lang === 'es' ? member['Descripción'] || 'Información no disponible' : member['Description (English)'] || member['Descripción'] || 'Information not available';
        const areas = lang === 'es' ? member['Áreas de interés'] || 'No especificadas' : member['Areas of Interest (English)'] || member['Áreas de interés'] || 'Not specified';
        const areasList = areas.split(';').map(a => a.trim()).filter(a => a);
        const imagen = getImageSrc(member['Imagen'] || '');
        const title = lang === 'es' ? `${nombre} - Equipo de la Revista Nacional de las Ciencias para Estudiantes` : `${nombre} - Team of the National Review of Sciences for Students`;
        const descHeading = lang === 'es' ? 'Descripción' : 'Description';
        const areasHeading = lang === 'es' ? 'Áreas de interés' : 'Areas of interest';
        const noSpecified = lang === 'es' ? 'No especificadas' : 'Not specified';
        const noImage = lang === 'es' ? 'Sin Imagen' : 'No Image';
        const back = lang === 'es' ? 'Volver al inicio' : 'Back to home';

        const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${descripcion.substring(0, 160)}...">
  <meta name="keywords" content="${areas}, ${roles}, ${lang === 'es' ? journalEs : journalEn}">
  <meta name="author" content="${nombre}">
  <title>${title}</title>
  <link rel="stylesheet" href="/index.css">
  <style>
    body {
      background-color: #f8f9fa;
      font-family: 'Merriweather', 'Georgia', serif;
      color: #2d3748;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    /* rest of style as is */
  </style>
</head>
<body>
  ${generateHeader(lang)}
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-img-container">
        ${imagen ? `<img src="${imagen}" alt="Foto de ${nombre}" class="profile-img">` : `<div class="profile-img-fallback">${noImage}</div>`}
      </div>
      <div class="profile-info">
        <h1>${nombre}</h1>
        <p class="role">${roles}</p>
      </div>
    </div>
    <div class="section">
      <h2>${descHeading}</h2>
      <p>${descripcion}</p>
    </div>
    <div class="section">
      <h2>${areasHeading}</h2>
      <div class="areas-tags">
        ${areasList.length ? areasList.map(area => `<span class="area-tag">${area}</span>`).join('') : '<p>' + noSpecified + '</p>'}
      </div>
    </div>
    <footer>
      <p>&copy; ${new Date().getFullYear()} ${lang === 'es' ? journalEs : journalEn}</p>
      <a href="/">${back}</a>
    </footer>
  </div>
</body>
</html>
        `.trim();
        const filePath = path.join(teamDir, `${slug}.html`);
        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`Generado HTML de miembro (${lang}): ${filePath}`);
      });
    }

    // Generar páginas estáticas para las secciones
    const sectionsMap = {
      about: getAboutContent,
      guidelines: getGuidelinesContent,
      faq: getFaqContent,
      submit: getSubmitContent,
      admin: getAdminContent,
    };

    for (const lang of ['es', 'en']) {
      const sectionsDir = path.join(sectionsOutputDir, lang);
      if (!fs.existsSync(sectionsDir)) fs.mkdirSync(sectionsDir, { recursive: true });

      for (const name in sectionsMap) {
        const label = lang === 'es' ? (name === 'about' ? 'Acerca de' : name === 'guidelines' ? 'Guías' : name === 'faq' ? 'Preguntas Frecuentes' : name === 'submit' ? 'Enviar Artículo' : name === 'admin' ? 'Administración' : '') : (name === 'about' ? 'About' : name === 'guidelines' ? 'Guidelines' : name === 'faq' ? 'Frequently Asked Questions' : name === 'submit' ? 'Submit Article' : name === 'admin' ? 'Administration' : '');
        const content = sectionsMap[name](lang);
        const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${label} - ${lang === 'es' ? journalEs : journalEn}">
  <meta name="keywords" content="${label}, ${lang === 'es' ? journalEs : journalEn}">
  <title>${label} - ${lang === 'es' ? journalEs : journalEn}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  ${generateHeader(lang)}
  <div class="py-8 max-w-7xl mx-auto">
    ${content}
  </div>
  ${generateFooter(lang)}
</body>
</html>
        `.trim();
        const filePath = path.join(sectionsDir, `${name}.html`);
        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`Generado HTML de sección (${lang}): ${filePath}`);
      }
    }

    // Procesar noticias para generar news.html
    const newsRes = await fetch(newsCsvUrl);
    if (!newsRes.ok) throw new Error(`Error descargando CSV de noticias: ${newsRes.statusText}`);
    const newsCsvData = await newsRes.text();
    const newsParsed = Papa.parse(newsCsvData, { header: true, skipEmptyLines: true });
    const news = newsParsed.data.map(row => ({
      titulo: row['Título'] || 'Sin título',
      cuerpo: row['Contenido de la noticia'] || '',
      fecha: row['Fecha'] || '',
    }));

    for (const lang of ['es', 'en']) {
      const sectionsDir = path.join(sectionsOutputDir, lang);
      const content = getNewsContent(lang, news);
      const label = lang === 'es' ? 'Noticias' : 'News';
      const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${label} - ${lang === 'es' ? journalEs : journalEn}">
  <meta name="keywords" content="${label}, ${lang === 'es' ? journalEs : journalEn}">
  <title>${label} - ${lang === 'es' ? journalEs : journalEn}</title>
  <link rel="stylesheet" href="/index.css">
</head>
<body>
  ${generateHeader(lang)}
  <div class="py-8 max-w-7xl mx-auto">
    ${content}
  </div>
  ${generateFooter(lang)}
</body>
</html>
        `.trim();
        const filePath = path.join(sectionsDir, 'news.html');
        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`Generado HTML de noticias (${lang}): ${filePath}`);
    }

    // Generar sitemap
    let sitemapUrls = '';
    for (const lang of ['es', 'en']) {
      sitemapUrls += articles.map(article => `
<url>
  <loc>${domain}/articles/${lang}/articulo${article.numeroArticulo}.html</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
<url>
  <loc>${article.pdf}</loc>
  <lastmod>${article.fecha}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
      `).join('');

      sitemapUrls += filteredMembers.map(member => {
        const nombre = lang === 'es' ? member['Nombre'] : member['Name (English)'] || member['Nombre'];
        const slug = generateSlug(nombre);
        return `
<url>
  <loc>${domain}/team/${lang}/${slug}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
        `;
      }).join('');

      // For sections
      for (const name in sectionsMap) {
        sitemapUrls += `
<url>
  <loc>${domain}/sections/${lang}/${name}.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
        `;
      }
      sitemapUrls += `
<url>
  <loc>${domain}/sections/${lang}/news.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.7</priority>
</url>
      `;
    }

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<!-- Created for Revista Nacional de las Ciencias para Estudiantes -->
<url>
  <loc>${domain}/</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
<url>
  <loc>${domain}/articles/es/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
<url>
  <loc>${domain}/articles/en/index.html</loc>
  <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
${sitemapUrls}
</urlset>`.replace(/^\s*\n/gm, '');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    console.log(`Generado sitemap: ${sitemapPath}`);

    // Generar robots.txt
    const robotsContent = `User-agent: Googlebot
Allow: /articles/
Allow: /Articles/
Allow: /team/
Allow: /sections/
Allow: /index.css
Disallow: /search
Disallow: /login
Disallow: /admin
Disallow: /submit
Disallow: /cart
Disallow: /api/
User-agent: *
Allow: /articles/
Allow: /Articles/
Allow: /team/
Allow: /sections/
Allow: /index.css
Disallow: /search
Disallow: /login
Disallow: /admin
Disallow: /submit
Disallow: /cart
Disallow: /api/
Sitemap: ${domain}/sitemap.xml
    `.trim();
    fs.writeFileSync(robotsPath, robotsContent, 'utf8');
    console.log(`Generado robots.txt: ${robotsPath}`);
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();