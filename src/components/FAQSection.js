import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';

function FAQSection() {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const [openIndex, setOpenIndex] = React.useState(null);
  const [filter, setFilter] = React.useState('all');

  const categories = {
    es: [
      { id: 'all', label: 'Todas' },
      { id: 'basico', label: 'Básico' },
      { id: 'envio', label: 'Envío' },
      { id: 'formato', label: 'Formato' },
      { id: 'etica', label: 'Ética' },
      { id: 'revision', label: 'Revisión' }
    ],
    en: [
      { id: 'all', label: 'All' },
      { id: 'basico', label: 'Basics' },
      { id: 'envio', label: 'Submission' },
      { id: 'formato', label: 'Format' },
      { id: 'etica', label: 'Ethics' },
      { id: 'revision', label: 'Review' }
    ]
  };

  const faqs = {
    es: [
      // ========== BÁSICO ==========
      {
        id: 'basico',
        q: '¿Quién puede publicar en la revista?',
        a: 'Cualquier estudiante de enseñanza media (secundaria) o universitaria (pregrado) de cualquier país puede enviar su trabajo. No necesitas tener un título académico, ser parte de una universidad prestigiosa ni contar con un profesor como coautor. Si eres estudiante y tienes un trabajo bien hecho, este es tu espacio.',
        links: [
          { text: 'Ver alcance completo', url: '/policies.html#alcance' }
        ]
      },
      {
        id: 'basico',
        q: '¿Tengo que pagar para publicar?',
        a: 'No. Absolutamente nada. La Revista Nacional de las Ciencias para Estudiantes es de Acceso Abierto Diamante, lo que significa que no cobramos por enviar, revisar, publicar ni leer artículos. Todos los costos son cubiertos por la propia revista. Publicar aquí es 100% gratuito.',
        links: [
          { text: 'Conocer el modelo Diamante', url: '/open-access.html#modelo-diamante' }
        ]
      },
      {
        id: 'basico',
        q: 'Soy de enseñanza media, ¿de verdad puedo publicar?',
        a: 'Sí, de verdad. La revista fue creada precisamente para dar espacio a estudiantes escolares y universitarios que quieren iniciarse en la comunicación científica. No esperamos que tu trabajo sea perfecto o revolucionario; esperamos que sea honesto, bien estructurado y que demuestre ganas de aprender. El proceso de revisión es formativo: te daremos retroalimentación para mejorar.',
      },
      {
        id: 'basico',
        q: '¿Necesito un profesor o tutor para publicar?',
        a: 'No es obligatorio. Puedes enviar un artículo como único autor o con coautores (compañeros de clase, por ejemplo). Si tuviste ayuda de un profesor en la investigación, puedes reconocerlo en la sección de "Agradecimientos" sin que figure como autor principal. Lo importante es que declares honestamente quién hizo qué.',
      },
      {
        id: 'basico',
        q: '¿Qué tipo de artículos aceptan?',
        a: 'Aceptamos varios formatos: Artículos de Investigación Original, Revisiones Sistemáticas, Ensayos Académicos, Reportes de Caso y Reseñas de Libros. Si tu trabajo no encaja perfectamente en ninguno, envíalo igualmente y el editor te orientará. Lo esencial es que sea un trabajo académico con fuentes citadas.',
        links: [
          { text: 'Ver tipos de manuscritos', url: '/policies.html#alcance' }
        ]
      },

      // ========== ENVÍO ==========
      {
        id: 'envio',
        q: '¿Cómo envío mi artículo?',
        a: 'El envío se realiza a través de nuestro portal editorial. Debes crear una cuenta (es gratis), completar un formulario con los datos del artículo y subir tu archivo en formato .docx. Antes de enviar, te recomendamos completar la Guía Rápida Interactiva para asegurarte de que no te falta nada.',
        links: [
          { text: 'Abrir Guía Rápida (5 min)', url: '/quick.html' },
          { text: 'Ir al portal de envío', url: '/submit' }
        ]
      },
      {
        id: 'envio',
        q: '¿Puedo enviar el mismo artículo a otra revista al mismo tiempo?',
        a: 'No. Esto se llama "envío simultáneo" y está prohibido. Si lo haces, tu artículo será rechazado inmediatamente y no podrás volver a enviar por un tiempo. La revista se compromete a responderte en un plazo razonable, así que no necesitas "asegurarte" enviando a varios lugares a la vez.',
      },
      {
        id: 'envio',
        q: '¿Qué es la anonimización y por qué es necesaria?',
        a: 'La revisión es "doble ciego": ni tú sabes quién revisa tu trabajo, ni el revisor sabe quién lo escribió. Para que esto funcione, tu documento no debe contener tu nombre, tu colegio o universidad, ni agradecimientos que te identifiquen. Es como entregar un examen sin nombre para que te evalúen solo por tu trabajo.',
        links: [
          { text: 'Aprender a anonimizar', url: '/author.html#anonimizacion' }
        ]
      },
      {
        id: 'envio',
        q: '¿Puedo enviar mi tesis o trabajo escolar?',
        a: 'Sí, siempre que cumpla con el requisito de originalidad. Tu manuscrito derivado de una tesis o trabajo previo no puede superar el 15% de similitud textual con la versión original. Esto significa que debes reescribir sustancialmente el contenido para adaptarlo al formato de artículo científico. La tesis es tu punto de partida, no el texto final.',
      },
      {
        id: 'envio',
        q: '¿En qué idioma debo enviar mi artículo?',
        a: 'Aceptamos artículos en español e inglés. Sea cual sea el idioma principal, debes incluir el título, resumen y palabras clave en ambos idiomas. Esto ayuda a que tu trabajo sea encontrado por más personas en bases de datos internacionales.',
      },

      // ========== FORMATO ==========
      {
        id: 'formato',
        q: '¿Qué formato de archivo debo usar?',
        a: 'Exclusivamente Microsoft Word (.docx). No aceptamos PDF, Google Docs, LaTeX sin convertir ni otros formatos. Si escribes en LaTeX, deberás convertirlo a .docx (por ejemplo, con Pandoc) y revisar que todo se vea correctamente. El .docx es el estándar para nuestro proceso editorial.',
        links: [
          { text: 'Instrucciones de conversión', url: '/author.html#formato-documento' }
        ]
      },
      {
        id: 'formato',
        q: '¿Cuántas palabras debe tener mi artículo?',
        a: 'Lo ideal es entre 1.000 y 10.000 palabras, incluyendo referencias. Si tu trabajo es más largo, no te rechazaremos automáticamente, pero el editor evaluará si la extensión está justificada. Si hay paja (repeticiones, contenido innecesario), te pedirá recortar.',
      },
      {
        id: 'formato',
        q: '¿Qué es el estilo Chicago 17 (Autor-Fecha)?',
        a: 'Es el formato de citación que usamos. En el texto, escribes el apellido del autor y el año entre paréntesis: (González 2020). Al final del documento, pones la lista completa de referencias en orden alfabético. Es como dar el "DNI" de cada fuente que usaste.',
        links: [
          { text: 'Ver ejemplos de citación', url: '/author.html#estilo-citacion' }
        ]
      },
      {
        id: 'formato',
        q: '¿Qué son los encabezados (Headings) y por qué son obligatorios?',
        a: 'Son los estilos que usas para organizar las secciones de tu texto (Heading 1, Heading 2, Heading 3). No debes simularlos con negrita o tamaños manuales. Los encabezados reales permiten que el editor navegue tu documento rápidamente y que la maquetación sea automática. Es como poner etiquetas de carpeta a cada sección.',
      },
      {
        id: 'formato',
        q: '¿Qué son los códigos de vocabulario controlado?',
        a: 'Son identificadores estandarizados que las bases de datos usan para clasificar tu artículo. Según tu área, usarás MeSH (salud), JEL (economía), ACM (computación), UNESCO (humanidades), etc. Solo debes escribir el código, no el término completo. Por ejemplo: "B14" en lugar de "B14: Marxismo".',
        links: [
          { text: 'Buscar códigos MeSH', url: 'https://meshb.nlm.nih.gov/search' },
          { text: 'Buscar códigos JEL', url: 'https://www.aeaweb.org/econlit/jelCodes.php' },
          { text: 'Ver tabla completa', url: '/policies.html#tabla-vocabularios' }
        ]
      },
      {
        id: 'formato',
        q: '¿Puedo usar plantillas o formatos predefinidos?',
        a: 'No proporcionamos una plantilla obligatoria. Lo importante es que tu documento use encabezados reales (Heading 1, 2, 3) y siga las normas de citación Chicago 17. La maquetación final la hacemos nosotros. Enfócate en el contenido y la estructura, no en el diseño visual.',
      },

      // ========== ÉTICA ==========
      {
        id: 'etica',
        q: '¿Qué pasa si mi artículo tiene más del 15% de similitud?',
        a: 'Si superas el 15%, el editor revisará de dónde proviene esa similitud. Si es por citas textuales mal parafraseadas, te pedirá corregirlas. Si es por copiar fragmentos extensos de otros trabajos (incluso propios), el artículo podría ser rechazado por plagio. La regla de oro: escribe con tus propias palabras y cita correctamente.',
      },
      {
        id: 'etica',
        q: '¿Puedo usar ChatGPT o inteligencia artificial para escribir?',
        a: 'Puedes usar IA para corregir gramática, mejorar la redacción o traducir. Lo que no puedes hacer es usar IA para generar secciones completas, inventar datos o crear figuras que representen evidencia científica. Si usas IA, debes declararlo en el formulario de envío: qué herramienta, qué versión y para qué la usaste.',
        links: [
          { text: 'Ver política completa de IA', url: '/policies.html#ia' }
        ]
      },
      {
        id: 'etica',
        q: '¿Necesito aprobación de un comité de ética?',
        a: 'Solo si tu investigación involucró directamente a personas (encuestas, experimentos con humanos, datos personales) o animales. Si hiciste una revisión bibliográfica, un ensayo teórico o un análisis de datos públicos, no necesitas aprobación. Si tienes dudas, marca "Sí" en el formulario y explica tu situación.',
      },
      {
        id: 'etica',
        q: '¿Qué es la declaración de disponibilidad de datos?',
        a: 'Es una frase que indica dónde están los datos que usaste en tu investigación. Puede ser en un repositorio público, en el material suplementario, o simplemente "disponibles bajo solicitud razonable". Si tu artículo no generó datos nuevos (por ejemplo, un ensayo), escribe "No aplica". Es un requisito de transparencia.',
      },
      {
        id: 'etica',
        q: '¿Qué es un conflicto de interés?',
        a: 'Es cualquier situación donde un interés personal podría influir en tu trabajo. Por ejemplo: recibiste dinero de una empresa cuyo producto analizas, o tu familiar es editor de la revista. Si no tienes nada que declarar, escribe: "Los autores declaran no tener conflictos de interés".',
      },

      // ========== REVISIÓN ==========
      {
        id: 'revision',
        q: '¿Cómo funciona la revisión por pares?',
        a: 'Tu artículo será revisado por al menos dos expertos en tu área (revisores externos). Ellos no saben quién eres y tú no sabes quiénes son. Evaluarán la originalidad, el rigor metodológico, la claridad y la relevancia. Después, te enviarán un informe con comentarios constructivos y una recomendación: aceptar, aceptar con cambios menores, aceptar con cambios mayores o rechazar.',
      },
      {
        id: 'revision',
        q: '¿Cuánto tarda el proceso de revisión?',
        a: 'El proceso completo (desde el envío hasta la decisión final) suele tomar entre 1 y 5 semanas, dependiendo de la complejidad del área y la disponibilidad de revisores. Te mantendremos informado en cada etapa. Si pasa más tiempo del esperado, puedes escribirnos para consultar el estado.',
      },
      {
        id: 'revision',
        q: '¿Qué pasa si mi artículo es rechazado?',
        a: 'No te desanimes. El rechazo es parte del proceso académico, incluso para investigadores experimentados. Te daremos un informe con las razones del rechazo y sugerencias para mejorar. Si consideras que el rechazo fue injusto, puedes apelar la decisión dentro de los 30 días siguientes.',
        links: [
          { text: 'Ver proceso de apelación', url: '/policies.html#apelaciones' }
        ]
      },
      {
        id: 'revision',
        q: '¿Puedo sugerir revisores o excluir a alguien?',
        a: 'Sí, puedes sugerir revisores potenciales (aunque no garantizamos que los usemos) y también puedes indicar personas que no quieres que revisen tu trabajo, con una breve justificación. Esta es una práctica estándar en revistas académicas para evitar conflictos de interés.',
      },
      {
        id: 'revision',
        q: '¿Qué es una "Revise and Resubmit" (Revisar y Reenviar)?',
        a: 'Es la decisión más común en revistas académicas. Significa que tu artículo tiene potencial, pero necesita cambios. Te daremos una lista de correcciones específicas. Tendrás un plazo para hacerlas y reenviar. No es un rechazo: es una invitación a mejorar.',
      },
      {
        id: 'revision',
        q: '¿Recibiré retroalimentación aunque mi artículo sea rechazado?',
        a: 'Sí, siempre. En caso de rechazo, recibirás los informes de los revisores con comentarios detallados. Si el rechazo es inmediato (desk reject) por no cumplir requisitos básicos, te explicaremos exactamente qué faltó y podrás corregirlo para un futuro envío.',
      },
      {
        id: 'revision',
        q: '¿Qué pasa después de que mi artículo es aceptado?',
        a: '¡Felicidades! Pasaremos a la fase de maquetación: daremos formato profesional a tu artículo, lo asignaremos a un número de la revista y le otorgaremos un DOI (identificador digital). Te enviaremos una prueba final para que la apruebes antes de la publicación definitiva.',
      },
      {
        id: 'revision',
        q: '¿Dónde se publicará mi artículo?',
        a: 'Tu artículo se publicará en el sitio web oficial de la revista, con acceso abierto y gratuito para todo el mundo. También se indexará en Google Académico y se preservará en repositorios digitales como Zenodo. Cualquier persona con internet podrá leerlo, descargarlo y citarlo.',
      }
    ],
    en: [
      // ========== BASICS ==========
      {
        id: 'basico',
        q: 'Who can publish in the journal?',
        a: 'Any high school or university student from any country can submit their work. You do not need an academic degree, be part of a prestigious university, or have a professor as co-author. If you are a student with well-done work, this is your space.',
        links: [
          { text: 'See full scope', url: '/policiesEN.html#scope' }
        ]
      },
      {
        id: 'basico',
        q: 'Do I have to pay to publish?',
        a: 'No. Absolutely nothing. The National Review of Sciences for Students is Diamond Open Access, meaning we do not charge to submit, review, publish, or read articles. All costs are covered by the journal itself. Publishing here is 100% free.',
        links: [
          { text: 'Learn about the Diamond model', url: '/open-accessEN.html#diamond-model' }
        ]
      },
      {
        id: 'basico',
        q: 'I am in high school, can I really publish?',
        a: 'Yes, really. The journal was created precisely to give space to high school and university students who want to start in scientific communication. We do not expect your work to be perfect or revolutionary; we expect it to be honest, well-structured, and demonstrate a desire to learn. The review process is formative: we will give you feedback to improve.',
      },
      {
        id: 'basico',
        q: 'Do I need a professor or tutor to publish?',
        a: 'No, it is not mandatory. You can submit an article as a single author or with co-authors (classmates, for example). If you had help from a professor in the research, you can acknowledge them in the "Acknowledgments" section without them being a main author. The important thing is to honestly declare who did what.',
      },
      {
        id: 'basico',
        q: 'What types of articles do you accept?',
        a: 'We accept several formats: Original Research Articles, Systematic Reviews, Academic Essays, Case Reports, and Book Reviews. If your work does not fit perfectly into any, send it anyway and the editor will guide you. The essential thing is that it is an academic work with cited sources.',
        links: [
          { text: 'See manuscript types', url: '/policiesEN.html#scope' }
        ]
      },

      // ========== SUBMISSION ==========
      {
        id: 'envio',
        q: 'How do I submit my article?',
        a: 'Submission is done through our editorial portal. You must create an account (free), complete a form with the article details, and upload your file in .docx format. Before submitting, we recommend completing the Interactive Quick Guide to make sure nothing is missing.',
        links: [
          { text: 'Open Quick Guide (5 min)', url: '/quickEN.html' },
          { text: 'Go to submission portal', url: '/en/submit' }
        ]
      },
      {
        id: 'envio',
        q: 'Can I submit the same article to another journal at the same time?',
        a: 'No. This is called "simultaneous submission" and is prohibited. If you do it, your article will be immediately rejected and you will not be able to submit again for a while. The journal is committed to responding in a reasonable time, so you do not need to "be safe" by submitting to several places at once.',
      },
      {
        id: 'envio',
        q: 'What is anonymization and why is it necessary?',
        a: 'The review is "double-blind": neither you know who reviews your work, nor does the reviewer know who wrote it. For this to work, your document must not contain your name, your school or university, or acknowledgments that identify you. It is like handing in an exam without a name to be evaluated only on your work.',
        links: [
          { text: 'Learn to anonymize', url: '/authorEN.html#anonymization' }
        ]
      },
      {
        id: 'envio',
        q: 'Can I submit my thesis or school work?',
        a: 'Yes, as long as it meets the originality requirement. Your manuscript derived from a thesis or previous work cannot exceed 15% textual similarity with the original version. This means you must substantially rewrite the content to adapt it to the scientific article format. The thesis is your starting point, not the final text.',
      },
      {
        id: 'envio',
        q: 'In what language should I submit my article?',
        a: 'We accept articles in Spanish and English. Whatever the main language, you must include the title, abstract, and keywords in both languages. This helps your work be found by more people in international databases.',
      },

      // ========== FORMAT ==========
      {
        id: 'formato',
        q: 'What file format should I use?',
        a: 'Exclusively Microsoft Word (.docx). We do not accept PDF, Google Docs, unconverted LaTeX, or other formats. If you write in LaTeX, you must convert it to .docx (e.g., with Pandoc) and check that everything looks correct. .docx is the standard for our editorial process.',
        links: [
          { text: 'Conversion instructions', url: '/authorEN.html#document-format' }
        ]
      },
      {
        id: 'formato',
        q: 'How many words should my article have?',
        a: 'Ideally between 1,000 and 10,000 words, including references. If your work is longer, we will not automatically reject it, but the editor will evaluate if the length is justified. If there is fluff (repetitions, unnecessary content), you will be asked to cut.',
      },
      {
        id: 'formato',
        q: 'What is Chicago 17 (Author-Date) style?',
        a: 'It is the citation format we use. In the text, you write the author\'s last name and the year in parentheses: (González 2020). At the end of the document, you put the complete list of references in alphabetical order. It is like giving the "ID card" of each source you used.',
        links: [
          { text: 'See citation examples', url: '/authorEN.html#citation-style' }
        ]
      },
      {
        id: 'formato',
        q: 'What are Headings and why are they mandatory?',
        a: 'They are the styles you use to organize the sections of your text (Heading 1, Heading 2, Heading 3). You should not simulate them with bold or manual sizes. Real headings allow the editor to navigate your document quickly and automatic formatting. It is like putting folder labels on each section.',
      },
      {
        id: 'formato',
        q: 'What are controlled vocabulary codes?',
        a: 'They are standardized identifiers that databases use to classify your article. Depending on your area, you will use MeSH (health), JEL (economics), ACM (computing), UNESCO (humanities), etc. You only need to write the code, not the full term. For example: "B14" instead of "B14: Marxism".',
        links: [
          { text: 'Search MeSH codes', url: 'https://meshb.nlm.nih.gov/search' },
          { text: 'Search JEL codes', url: 'https://www.aeaweb.org/econlit/jelCodes.php' },
          { text: 'See full table', url: '/policiesEN.html#vocabulary-table' }
        ]
      },
      {
        id: 'formato',
        q: 'Can I use templates or predefined formats?',
        a: 'We do not provide a mandatory template. The important thing is that your document uses real headings (Heading 1, 2, 3) and follows Chicago 17 citation rules. We do the final layout. Focus on content and structure, not on visual design.',
      },

      // ========== ETHICS ==========
      {
        id: 'etica',
        q: 'What happens if my article has more than 15% similarity?',
        a: 'If you exceed 15%, the editor will review where that similarity comes from. If it is from poorly paraphrased direct quotes, you will be asked to correct them. If it is from copying extensive fragments of other works (even your own), the article could be rejected for plagiarism. The golden rule: write in your own words and cite correctly.',
      },
      {
        id: 'etica',
        q: 'Can I use ChatGPT or artificial intelligence to write?',
        a: 'You can use AI to correct grammar, improve writing, or translate. What you cannot do is use AI to generate complete sections, invent data, or create figures that represent scientific evidence. If you use AI, you must declare it on the submission form: which tool, which version, and what you used it for.',
        links: [
          { text: 'See full AI policy', url: '/policiesEN.html#ai' }
        ]
      },
      {
        id: 'etica',
        q: 'Do I need ethics committee approval?',
        a: 'Only if your research directly involved people (surveys, human experiments, personal data) or animals. If you did a literature review, theoretical essay, or analysis of public data, you do not need approval. If in doubt, mark "Yes" on the form and explain your situation.',
      },
      {
        id: 'etica',
        q: 'What is a data availability statement?',
        a: 'It is a sentence that indicates where the data you used in your research is located. It can be in a public repository, in supplementary material, or simply "available upon reasonable request". If your article did not generate new data (e.g., an essay), write "Not applicable". It is a transparency requirement.',
      },
      {
        id: 'etica',
        q: 'What is a conflict of interest?',
        a: 'It is any situation where a personal interest could influence your work. For example: you received money from a company whose product you analyze, or your relative is the journal editor. If you have nothing to declare, write: "The authors declare no conflicts of interest".',
      },

      // ========== REVIEW ==========
      {
        id: 'revision',
        q: 'How does peer review work?',
        a: 'Your article will be reviewed by at least two experts in your area (external reviewers). They do not know who you are and you do not know who they are. They will evaluate originality, methodological rigor, clarity, and relevance. Then, they will send you a report with constructive comments and a recommendation: accept, accept with minor changes, accept with major changes, or reject.',
      },
      {
        id: 'revision',
        q: 'How long does the review process take?',
        a: 'The complete process (from submission to final decision) usually takes between 1 and 5 weeks, depending on the complexity of the area and reviewer availability. We will keep you informed at each stage. If more time passes than expected, you can write to us to check the status.',
      },
      {
        id: 'revision',
        q: 'What happens if my article is rejected?',
        a: 'Do not be discouraged. Rejection is part of the academic process, even for experienced researchers. We will give you a report with the reasons for rejection and suggestions for improvement. If you consider the rejection unfair, you can appeal the decision within 30 days.',
        links: [
          { text: 'See appeal process', url: '/policiesEN.html#appeals' }
        ]
      },
      {
        id: 'revision',
        q: 'Can I suggest reviewers or exclude someone?',
        a: 'Yes, you can suggest potential reviewers (although we do not guarantee we will use them) and you can also indicate people you do not want to review your work, with a brief justification. This is a standard practice in academic journals to avoid conflicts of interest.',
      },
      {
        id: 'revision',
        q: 'What is a "Revise and Resubmit"?',
        a: 'It is the most common decision in academic journals. It means your article has potential, but needs changes. We will give you a list of specific corrections. You will have a deadline to make them and resubmit. It is not a rejection: it is an invitation to improve.',
      },
      {
        id: 'revision',
        q: 'Will I receive feedback even if my article is rejected?',
        a: 'Yes, always. In case of rejection, you will receive the reviewers\' reports with detailed comments. If the rejection is immediate (desk reject) for not meeting basic requirements, we will explain exactly what was missing and you can correct it for a future submission.',
      },
      {
        id: 'revision',
        q: 'What happens after my article is accepted?',
        a: 'Congratulations! We will move to the layout phase: we will give your article professional formatting, assign it to a journal issue, and give it a DOI (digital identifier). We will send you a final proof for approval before definitive publication.',
      },
      {
        id: 'revision',
        q: 'Where will my article be published?',
        a: 'Your article will be published on the journal\'s official website, with open and free access for everyone. It will also be indexed in Google Scholar and preserved in digital repositories such as Zenodo. Anyone with internet access will be able to read it, download it, and cite it.',
      }
    ]
  };

  const currentFaqs = faqs[isSpanish ? 'es' : 'en'];
  const currentCategories = categories[isSpanish ? 'es' : 'en'];

  const filteredFaqs = filter === 'all' 
    ? currentFaqs 
    : currentFaqs.filter(f => f.id === filter);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-[#f4f5f7]">
      <div className="max-w-4xl mx-auto px-6">
        {/* Encabezado estilo editorial */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#004b87] mb-3">
            {isSpanish ? 'Preguntas Frecuentes' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-sm text-gray-500 font-serif italic max-w-2xl mx-auto">
            {isSpanish 
              ? 'Resolvemos las dudas más comunes de estudiantes que publican por primera vez.'
              : 'We answer the most common questions from students publishing for the first time.'}
          </p>
          <div className="h-px w-24 bg-[#004b87] mx-auto mt-6"></div>
        </div>

        {/* Filtros por categoría */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {currentCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setFilter(cat.id);
                setOpenIndex(null);
              }}
              className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all
                ${filter === cat.id 
                  ? 'bg-[#004b87] text-white shadow-sm' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#004b87] hover:text-[#004b87]'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Acordeones estilo Elsevier */}
        <div className="space-y-3">
          {filteredFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={`bg-white rounded-sm border transition-all overflow-hidden
                  ${isOpen 
                    ? 'border-[#004b87] shadow-md' 
                    : 'border-gray-200 hover:border-[#006dae] hover:shadow-sm'}`}
              >
                {/* Encabezado del acordeón */}
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full flex items-center justify-between p-5 text-left group"
                >
                  <span className={`text-sm font-bold transition-colors
                    ${isOpen ? 'text-[#004b87]' : 'text-gray-900 group-hover:text-[#006dae]'}`}>
                    {faq.q}
                  </span>
                  <span className={`flex-shrink-0 ml-4 w-8 h-8 rounded-sm flex items-center justify-center transition-all
                    ${isOpen ? 'bg-[#004b87] text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-[#e0ecf4] group-hover:text-[#004b87]'}`}>
                    <svg 
                      className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </button>

                {/* Contenido expandible */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-5 pb-5 pt-0">
                        <div className="border-t border-gray-100 pt-4">
                          <p className="text-sm text-gray-700 font-serif leading-relaxed">
                            {faq.a}
                          </p>
                          
                          {/* Enlaces adicionales */}
                          {faq.links && faq.links.length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-4">
                              {faq.links.map((link, i) => (
                                <a
                                  key={i}
                                  href={link.url}
                                  target={link.url.startsWith('http') ? '_blank' : undefined}
                                  rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#006dae] hover:text-[#e86125] transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  {link.text} →
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Contador de preguntas */}
        <div className="mt-8 text-center text-xs text-gray-500 font-sans uppercase tracking-wider">
          {isSpanish 
            ? `${filteredFaqs.length} preguntas mostrando` 
            : `${filteredFaqs.length} questions showing`}
        </div>

        {/* Banner final: Guía Rápida */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-[#004b87] text-white p-8 rounded-sm shadow-md"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-16 h-16 bg-white/10 rounded-sm flex items-center justify-center">
              <svg className="w-8 h-8 text-[#c0a86a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-serif font-bold mb-2">
                {isSpanish 
                  ? '¿Listo para empezar?'
                  : 'Ready to get started?'}
              </h3>
              <p className="text-sm text-gray-300 font-sans leading-relaxed">
                {isSpanish 
                  ? 'Completa la Guía Rápida Interactiva en 5 minutos y asegúrate de que no te falta nada antes de enviar.'
                  : 'Complete the Interactive Quick Guide in 5 minutes and make sure you have everything before submitting.'}
              </p>
            </div>
            <a
              href={isSpanish ? '/quick.html' : '/quickEN.html'}
              className="px-8 py-3 bg-[#c0a86a] text-[#004b87] font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-white transition-colors flex-shrink-0"
            >
              {isSpanish ? 'Abrir Guía Rápida' : 'Open Quick Guide'} →
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default FAQSection;