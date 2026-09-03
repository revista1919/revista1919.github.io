// src/components/AimsScopeSection.jsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AcademicCapIcon, 
  GlobeAltIcon, 
  BeakerIcon, 
  ShieldCheckIcon, 
  BookOpenIcon,
  UserGroupIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  HeartIcon,
  LightBulbIcon,
  FlagIcon,
  DocumentTextIcon,
  ScaleIcon,
  EyeIcon,
  LockClosedIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useLanguage } from '../hooks/useLanguage';

function AimsScopeSection() {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [activeSection, setActiveSection] = useState('mission');

  // Scroll spy para detectar sección activa
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        'mission',
        'objectives',
        'scope',
        'types',
        'exclusions',
        'values',
        'audience',
      ];

      let current = 'mission';
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Al hacer click en un enlace, navegar con hash
  const handleNavClick = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
    }
  };

  // ================= TEXTOS BILINGÜES =================
  const texts = {
    tagline: isSpanish ? 'Misión · Alcance · Objetivos' : 'Mission · Scope · Objectives',
    title: isSpanish ? (
      <>Un espacio para la <span className="italic text-[#e86125]">investigación temprana</span> con estándares profesionales.</>
    ) : (
      <>A space for <span className="italic text-[#e86125]">early research</span> with professional standards.</>
    ),
    subtitle: isSpanish 
      ? 'La Revista Nacional de las Ciencias para Estudiantes define claramente su propósito editorial, las disciplinas que abarca y los tipos de contribuciones que recibe.'
      : 'The National Review of Sciences for Students clearly defines its editorial purpose, the disciplines it covers, and the types of contributions it receives.',

    // Sidebar navigation
    sidebarTitle: isSpanish ? 'Índice' : 'Contents',
    nav: [
      { id: 'mission', label: isSpanish ? 'Propósito Editorial' : 'Editorial Purpose' },
      { id: 'objectives', label: isSpanish ? 'Objetivos Editoriales' : 'Editorial Objectives' },
      { id: 'scope', label: isSpanish ? 'Alcance Temático' : 'Thematic Scope' },
      { id: 'types', label: isSpanish ? 'Tipos de Contribuciones' : 'Contribution Types' },
      { id: 'exclusions', label: isSpanish ? 'Lo que NO Publicamos' : 'What We Do NOT Publish' },
      { id: 'values', label: isSpanish ? 'Principios Rectores' : 'Guiding Principles' },
      { id: 'audience', label: isSpanish ? 'Comunidad' : 'Community' },
    ],

    missionTitle: isSpanish ? 'Propósito Editorial' : 'Editorial Purpose',
    missionText1: isSpanish 
      ? 'La Revista Nacional de las Ciencias para Estudiantes es una publicación académica arbitrada, de acceso abierto Diamante y sin fines de lucro. Nuestro propósito es proporcionar una plataforma de publicación rigurosa donde estudiantes de educación media y universitaria puedan comunicar sus investigaciones bajo los mismos estándares de calidad que una revista consolidada.'
      : 'The National Review of Sciences for Students is a peer-reviewed, Diamond Open Access, non-profit academic publication. Our purpose is to provide a rigorous publishing platform where secondary and university students can communicate their research under the same quality standards as an established journal.',
    
    missionText2: isSpanish 
      ? 'La Revista no busca ser un espacio de especialización inaccesible, sino un puente formativo entre el aula y la publicación académica profesional.'
      : 'The Journal does not seek to be an inaccessible specialized space, but rather a formative bridge between the classroom and professional academic publishing.',

    quote: isSpanish 
      ? '"No publicamos por publicar: publicamos para formar, para visibilizar y para demostrar que la edad no es límite para el rigor."'
      : '"We do not publish for the sake of publishing: we publish to educate, to give visibility, and to demonstrate that age is no limit to rigor."',

    // Diamond highlight
    diamondTitle: isSpanish ? 'Modelo Diamante' : 'Diamond Model',
    diamondText: isSpanish 
      ? 'Acceso 100% gratuito para autores y lectores. Sin cargos por procesamiento (APC) ni suscripciones.'
      : '100% free access for authors and readers. No Article Processing Charges (APCs) or subscriptions.',
    diamondLink: isSpanish ? '/open-access.html' : '/open-accessEN.html',
    diamondLinkText: isSpanish ? 'Ver Política de Acceso Abierto →' : 'View Open Access Policy →',

    objectivesTitle: isSpanish ? 'Objetivos Editoriales' : 'Editorial Objectives',
    objectives: [
      {
        icon: FlagIcon,
        title: isSpanish ? 'Visibilizar Talento Temprano' : 'Showcasing Early Talent',
        desc: isSpanish 
          ? 'Dar visibilidad a investigaciones estudiantiles que, por su calidad, merecen un espacio en el registro académico formal.'
          : 'Give visibility to student research that, due to its quality, deserves a place in the formal academic record.'
      },
      {
        icon: AcademicCapIcon,
        title: isSpanish ? 'Formar en Publicación Académica' : 'Training in Academic Publishing',
        desc: isSpanish 
          ? 'Enseñar el proceso completo de publicación: preparación de manuscritos, respuesta a revisores, ética y buenas prácticas.'
          : 'Teach the complete publication process: manuscript preparation, reviewer response, ethics, and good practices.'
      },
      {
        icon: GlobeAltIcon,
        title: isSpanish ? 'Democratizar el Conocimiento' : 'Democratizing Knowledge',
        desc: isSpanish 
          ? 'Eliminar barreras económicas mediante el acceso abierto Diamante, garantizando que publicar sea gratuito para autores y lectores.'
          : 'Eliminate economic barriers through Diamond Open Access, ensuring that publishing is free for authors and readers.'
      },
      {
        icon: ScaleIcon,
        title: isSpanish ? 'Garantizar Rigor Metodológico' : 'Ensuring Methodological Rigor',
        desc: isSpanish 
          ? 'Aplicar revisión por pares doble ciego estricta con estándares internacionales (COPE, ICMJE) a cada manuscrito recibido.'
          : 'Apply strict double-blind peer review with international standards (COPE, ICMJE) to every manuscript received.'
      }
    ],

    scopeTitle: isSpanish ? 'Alcance Temático' : 'Thematic Scope',
    scopeSubtitle: isSpanish 
      ? 'La Revista es multidisciplinaria y acepta contribuciones en español e inglés de todas las áreas del conocimiento académico.'
      : 'The Journal is multidisciplinary and accepts contributions in Spanish and English from all areas of academic knowledge.',
    
    areas: [
      {
        icon: BeakerIcon,
        title: isSpanish ? 'Ciencias Exactas y Naturales' : 'Exact and Natural Sciences',
        disciplines: isSpanish 
          ? 'Matemáticas, Física, Química, Biología, Geología, Astronomía, Ciencias Ambientales, Oceanografía, Meteorología, Paleontología'
          : 'Mathematics, Physics, Chemistry, Biology, Geology, Astronomy, Environmental Sciences, Oceanography, Meteorology, Paleontology'
      },
      {
        icon: HeartIcon,
        title: isSpanish ? 'Ciencias de la Salud' : 'Health Sciences',
        disciplines: isSpanish 
          ? 'Medicina, Salud Pública, Enfermería, Nutrición, Farmacología, Odontología, Kinesiología, Tecnología Médica, Veterinaria'
          : 'Medicine, Public Health, Nursing, Nutrition, Pharmacology, Dentistry, Kinesiology, Medical Technology, Veterinary Medicine'
      },
      {
        icon: GlobeAltIcon,
        title: isSpanish ? 'Ingeniería y Tecnología' : 'Engineering and Technology',
        disciplines: isSpanish 
          ? 'Civil, Industrial, Mecánica, Eléctrica, Química, Computación, Ciencia de Datos, Robótica, Materiales, Aeroespacial, Energías Renovables'
          : 'Civil, Industrial, Mechanical, Electrical, Chemical, Computing, Data Science, Robotics, Materials, Aerospace, Renewable Energy'
      },
      {
        icon: BookOpenIcon,
        title: isSpanish ? 'Ciencias Sociales' : 'Social Sciences',
        disciplines: isSpanish 
          ? 'Sociología, Antropología, Psicología, Economía, Ciencias Políticas, Derecho, Geografía Humana, Género, Comunicación, Educación, Trabajo Social'
          : 'Sociology, Anthropology, Psychology, Economics, Political Science, Law, Human Geography, Gender Studies, Communication, Education, Social Work'
      },
      {
        icon: AcademicCapIcon,
        title: isSpanish ? 'Humanidades' : 'Humanities',
        disciplines: isSpanish 
          ? 'Historia, Filosofía, Lingüística, Literatura, Estudios Clásicos, Teología, Estudios Culturales, Arte, Arquitectura'
          : 'History, Philosophy, Linguistics, Literature, Classical Studies, Theology, Cultural Studies, Art, Architecture'
      },
      {
        icon: SparklesIcon,
        title: isSpanish ? 'Ciencias Agropecuarias' : 'Agricultural Sciences',
        disciplines: isSpanish 
          ? 'Agronomía, Ciencias Forestales, Acuicultura, Zootecnia, Ingeniería de Alimentos'
          : 'Agronomy, Forestry Sciences, Aquaculture, Animal Science, Food Engineering'
      }
    ],

    typesTitle: isSpanish ? 'Tipos de Contribuciones Aceptadas' : 'Accepted Contribution Types',
    typesSubtitle: isSpanish 
      ? 'La Revista recibe seis formatos distintos, cada uno con requisitos específicos de estructura, contenido y extensión.'
      : 'The Journal receives six distinct formats, each with specific structure, content, and length requirements.',
    types: [
      {
        name: isSpanish ? 'Artículo de Investigación Original' : 'Original Research Article',
        length: isSpanish ? '3.000–8.000 palabras' : '3,000–8,000 words',
        desc: isSpanish 
          ? 'Resultados inéditos de investigaciones empíricas o teóricas estructurados en formato IMRyD.'
          : 'Unpublished results of empirical or theoretical research structured in IMRaD format.'
      },
      {
        name: isSpanish ? 'Ensayo Académico' : 'Academic Essay',
        length: isSpanish ? '3.000–6.000 palabras' : '3,000–6,000 words',
        desc: isSpanish 
          ? 'Tesis original sustentada en revisión crítica de literatura con aparato argumentativo riguroso.'
          : 'Original thesis supported by critical literature review with rigorous argumentative apparatus.'
      },
      {
        name: isSpanish ? 'Ensayo Reflexivo' : 'Reflective Essay',
        length: isSpanish ? '1.500–3.000 palabras' : '1,500–3,000 words',
        desc: isSpanish 
          ? 'Reflexiones personales sobre una experiencia académica con conexión teórica fundamentada.'
          : 'Personal reflections on an academic experience with well-founded theoretical connection.'
      },
      {
        name: isSpanish ? 'Reporte de Caso' : 'Case Report',
        length: isSpanish ? '2.000–4.000 palabras' : '2,000–4,000 words',
        desc: isSpanish 
          ? 'Caso único (clínico, social, técnico) con análisis detallado y lecciones aprendidas.'
          : 'Unique case (clinical, social, technical) with detailed analysis and lessons learned.'
      },
      {
        name: isSpanish ? 'Revisión Sistemática' : 'Systematic Review',
        length: isSpanish ? '4.000–10.000 palabras' : '4,000–10,000 words',
        desc: isSpanish 
          ? 'Síntesis crítica de evidencia existente con metodología explícita y reproducible.'
          : 'Critical synthesis of existing evidence with explicit and reproducible methodology.'
      },
      {
        name: isSpanish ? 'Book Review (Reseña)' : 'Book Review',
        length: isSpanish ? '1.000–2.000 palabras' : '1,000–2,000 words',
        desc: isSpanish 
          ? 'Análisis crítico de una obra académica reciente de relevancia demostrable.'
          : 'Critical analysis of a recent academic work of demonstrable relevance.'
      }
    ],

    exclusionsTitle: isSpanish ? 'Lo que NO Publicamos' : 'What We Do NOT Publish',
    exclusions: [
      isSpanish 
        ? 'Documentos de trabajo preliminares (working papers) sin proceso formal de investigación'
        : 'Preliminary working papers without a formal research process',
      isSpanish 
        ? 'Preprints en estado no finalizado o informes técnicos no arbitrados'
        : 'Unfinished preprints or non-peer-reviewed technical reports',
      isSpanish 
        ? 'Contenido que no cumpla con los estándares de originalidad (máximo 15% de similitud)'
        : 'Content that does not meet originality standards (maximum 15% similarity)',
      isSpanish 
        ? 'Manuscritos que no se ajusten al estilo Chicago 17.ª edición (Autor-Fecha)'
        : 'Manuscripts that do not conform to Chicago 17th ed. (Author-Date) style',
    ],

    valuesTitle: isSpanish ? 'Principios Rectores' : 'Guiding Principles',
    values: [
      {
        icon: LockClosedIcon,
        title: isSpanish ? 'Acceso Abierto Diamante' : 'Diamond Open Access',
        desc: isSpanish ? 'Sin costos para autores ni lectores' : 'No costs for authors or readers'
      },
      {
        icon: EyeIcon,
        title: isSpanish ? 'Doble Ciego Estricto' : 'Strict Double-Blind',
        desc: isSpanish ? 'Evaluación imparcial y anónima' : 'Impartial and anonymous evaluation'
      },
      {
        icon: SparklesIcon,
        title: isSpanish ? 'Carácter Formativo' : 'Formative Character',
        desc: isSpanish ? 'Retroalimentación orientada al aprendizaje' : 'Learning-oriented feedback'
      },
      {
        icon: GlobeAltIcon,
        title: isSpanish ? 'Multidisciplinario' : 'Multidisciplinary',
        desc: isSpanish ? 'Todas las áreas del conocimiento' : 'All areas of knowledge'
      },
      {
        icon: BookOpenIcon,
        title: isSpanish ? 'Bilingüe' : 'Bilingual',
        desc: isSpanish ? 'Publicación en español e inglés' : 'Publication in Spanish and English'
      },
      {
        icon: ShieldCheckIcon,
        title: isSpanish ? 'Ética Internacional' : 'International Ethics',
        desc: isSpanish ? 'COPE, BOAI, CRediT, ICMJE' : 'COPE, BOAI, CRediT, ICMJE'
      }
    ],

    audienceTitle: isSpanish ? 'Comunidad a la que Servimos' : 'Community We Serve',
    audience: [
      {
        title: isSpanish ? 'Autores Estudiantes' : 'Student Authors',
        desc: isSpanish 
          ? 'Estudiantes de educación media y universitaria de Chile y Latinoamérica que inician su trayectoria de publicación.'
          : 'Secondary and university students from Chile and Latin America beginning their publication journey.'
      },
      {
        title: isSpanish ? 'Comunidad Académica' : 'Academic Community',
        desc: isSpanish 
          ? 'Investigadores, docentes y académicos interesados en la producción científica emergente.'
          : 'Researchers, educators, and academics interested in emerging scientific production.'
      },
      {
        title: isSpanish ? 'Revisores Formadores' : 'Formative Reviewers',
        desc: isSpanish 
          ? 'Académicos y estudiantes destacados que contribuyen a la evaluación constructiva de manuscritos.'
          : 'Academics and outstanding students who contribute to constructive manuscript evaluation.'
      }
    ],

    ctaTitle: isSpanish ? '¿Quieres ser parte de este proyecto?' : 'Want to be part of this project?',
    ctaText: isSpanish 
      ? 'Consulta nuestra guía completa para autores y descubre los requisitos detallados para preparar tu manuscrito.'
      : 'Check our complete author guidelines and discover the detailed requirements to prepare your manuscript.',
    ctaButton: isSpanish ? 'Ver Guía para Autores' : 'View Author Guidelines',
    ctaLink: isSpanish ? '/author.html' : '/authorEN.html',
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      } 
    }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* ENCABEZADO EDITORIAL */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12 text-center"
        >
          <span className="text-[#e86125] font-bold text-[10px] tracking-[0.25em] uppercase mb-3 block font-sans">
            {texts.tagline}
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif text-black mb-4 tracking-tight">
            {texts.title}
          </h2>
          <p className="text-[15px] text-[#666666] max-w-2xl mx-auto font-sans leading-relaxed">
            {texts.subtitle}
          </p>
          <div className="h-[2px] w-16 bg-[#e86125] mx-auto mt-6"></div>
        </motion.div>

        {/* GRID CON SIDEBAR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* SIDEBAR STICKY */}
          <motion.aside 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="lg:col-span-3"
          >
            <div className="sticky top-28 bg-white border border-[#e6e8ea] border-t-4 border-t-[#004b87] rounded-sm shadow-lg">
              <h3 className="text-[11px] font-bold font-sans uppercase tracking-[0.15em] text-[#004b87] px-5 pt-4 pb-3 border-b border-[#e6e8ea]">
                {texts.sidebarTitle}
              </h3>
              <ul className="py-2">
                {texts.nav.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full text-left px-5 py-2.5 text-[12px] font-sans transition-all border-l-3 ${
                        activeSection === item.id
                          ? 'border-l-[#e86125] bg-[#FFF0E6] text-[#004b87] font-semibold'
                          : 'border-l-transparent text-[#666666] hover:bg-[#f8f9fa] hover:text-[#004b87]'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </motion.aside>

          {/* CONTENIDO PRINCIPAL */}
          <div className="lg:col-span-9 space-y-16">

            {/* PROPÓSITO EDITORIAL */}
            <motion.div 
              id="mission"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-7 space-y-5">
                  <h3 className="text-[16px] font-serif font-bold text-black tracking-tight">
                    {texts.missionTitle}
                  </h3>
                  <p className="text-[14px] text-[#2b2b2b] leading-relaxed font-sans">
                    {texts.missionText1}
                  </p>
                  <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                    {texts.missionText2}
                  </p>
                  <blockquote className="border-l-4 border-[#e86125] pl-5 py-1">
                    <p className="font-serif text-lg font-light text-black leading-snug italic">
                      {texts.quote}
                    </p>
                  </blockquote>
                </div>
                
                <div className="md:col-span-5">
                  <div className="bg-[#f8f9fa] border border-[#e6e8ea] border-l-4 border-l-[#e86125] rounded-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <LockClosedIcon className="w-6 h-6 text-[#002147]" />
                      <h4 className="font-serif font-semibold text-black text-[15px]">
                        {texts.diamondTitle}
                      </h4>
                    </div>
                    <p className="text-[12px] text-[#666666] leading-relaxed font-sans mb-3">
                      {texts.diamondText}
                    </p>
                    <a 
                      href={texts.diamondLink}
                      className="text-[11px] font-bold uppercase tracking-wider text-[#002147] hover:text-[#e86125] transition-colors font-sans"
                    >
                      {texts.diamondLinkText}
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* OBJETIVOS EDITORIALES */}
            <motion.div 
              id="objectives"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-6">
                {texts.objectivesTitle}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {texts.objectives.map((obj, i) => (
                  <motion.div 
                    key={i}
                    variants={staggerItem}
                    className="bg-white border border-[#e6e8ea] rounded-sm p-5 hover:border-[#e86125] transition-colors shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#f4f5f7] rounded-sm flex items-center justify-center flex-shrink-0 group-hover:bg-[#e86125]/5 transition-colors">
                        <obj.icon className="w-5 h-5 text-[#002147] group-hover:text-[#e86125] transition-colors" />
                      </div>
                      <div>
                        <h4 className="font-serif font-semibold text-black mb-1 text-[14px] tracking-tight">
                          {obj.title}
                        </h4>
                        <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                          {obj.desc}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ALCANCE TEMÁTICO */}
            <motion.div 
              id="scope"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-3">
                {texts.scopeTitle}
              </h3>
              <p className="text-[13px] text-[#666666] mb-6 font-sans">
                {texts.scopeSubtitle}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {texts.areas.map((area, i) => (
                  <motion.div 
                    key={i}
                    variants={staggerItem}
                    className="bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm p-4 hover:border-[#002147] transition-all hover:shadow-md group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <area.icon className="w-4 h-4 text-[#e86125] flex-shrink-0" />
                      <h4 className="font-serif font-semibold text-black text-[13px] tracking-tight">
                        {area.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-[#666666] leading-relaxed font-sans">
                      {area.disciplines}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* TIPOS DE CONTRIBUCIONES */}
            <motion.div 
              id="types"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-3">
                {texts.typesTitle}
              </h3>
              <p className="text-[13px] text-[#666666] mb-6 font-sans">
                {texts.typesSubtitle}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {texts.types.map((type, i) => (
                  <motion.div 
                    key={i}
                    variants={staggerItem}
                    className="flex items-start gap-3 bg-white border border-[#e6e8ea] rounded-sm p-4 hover:border-[#e86125] transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-[#e86125] rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-serif font-semibold text-black text-[13px] tracking-tight">
                          {type.name}
                        </h4>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#a0a0a0] bg-[#f4f5f7] px-2 py-0.5 rounded-sm flex-shrink-0 font-sans">
                          {type.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#666666] leading-relaxed font-sans">
                        {type.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* LO QUE NO PUBLICAMOS */}
            <motion.div 
              id="exclusions"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-6">
                {texts.exclusionsTitle}
              </h3>
              
              <motion.div 
                variants={staggerItem}
                className="bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm p-5"
              >
                <ul className="space-y-2">
                  {texts.exclusions.map((exclusion, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-[#666666] font-sans">
                      <XCircleIcon className="w-4 h-4 text-[#e86125] flex-shrink-0 mt-0.5" />
                      <span>{exclusion}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>

            {/* PRINCIPIOS RECTORES */}
            <motion.div 
              id="values"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-6">
                {texts.valuesTitle}
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {texts.values.map((val, i) => (
                  <motion.div 
                    key={i}
                    variants={staggerItem}
                    className="text-center p-4 bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm hover:border-[#e86125] transition-all"
                  >
                    <val.icon className="w-6 h-6 text-[#002147] mx-auto mb-2" />
                    <h4 className="font-serif font-semibold text-black text-[12px] mb-1">
                      {val.title}
                    </h4>
                    <p className="text-[10px] text-[#a0a0a0] font-sans">
                      {val.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* COMUNIDAD */}
            <motion.div 
              id="audience"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="scroll-mt-28"
            >
              <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-6">
                {texts.audienceTitle}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {texts.audience.map((aud, i) => (
                  <motion.div 
                    key={i}
                    variants={staggerItem}
                    className="bg-white border border-[#e6e8ea] rounded-sm p-5 text-center hover:shadow-md transition-all"
                  >
                    <h4 className="font-serif font-bold text-black text-[15px] mb-2">
                      {aud.title}
                    </h4>
                    <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                      {aud.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* CTA FINAL */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center border-t border-[#e6e8ea] pt-10"
            >
              <h3 className="font-serif text-xl text-black mb-2 tracking-tight">
                {texts.ctaTitle}
              </h3>
              <p className="text-[13px] text-[#666666] mb-5 font-sans">
                {texts.ctaText}
              </p>
              <a 
                href={texts.ctaLink}
                className="inline-flex items-center gap-2 bg-[#002147] hover:bg-[#e86125] text-white px-7 py-3 text-xs font-bold uppercase tracking-widest transition-colors font-sans rounded-sm"
              >
                {texts.ctaButton}
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}

export default AimsScopeSection;