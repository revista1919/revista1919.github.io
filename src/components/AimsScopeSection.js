// src/components/AimsScopeSection.jsx
import React from 'react';
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
  LightBulbIcon
} from '@heroicons/react/24/outline';
import { useLanguage } from '../hooks/useLanguage';

function AimsScopeSection() {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // ================= TEXTOS BILINGÜES =================
  const texts = {
    // Header
    tagline: isSpanish ? 'Misión y Alcance' : 'Aims & Scope',
    title: isSpanish ? (
      <>Impulsando a la próxima generación del <span className="italic text-[#e86125]">rigor científico.</span></>
    ) : (
      <>Empowering the next generation of <span className="italic text-[#e86125]">scientific rigor.</span></>
    ),
    subtitle: isSpanish 
      ? 'Una revista científica arbitrada por pares, dedicada a difundir e impulsar la investigación temprana a nivel escolar y universitario.'
      : 'A peer-reviewed scientific journal dedicated to disseminating and promoting early research at the school and university level.',

    // Mission section
    missionTitle: isSpanish ? 'Nuestra Misión' : 'Our Mission',
    missionText1: isSpanish 
      ? 'La Revista Nacional de las Ciencias para Estudiantes es una publicación académica arbitrada, de acceso abierto Diamante y sin fines de lucro. Nuestro propósito es democratizar el acceso a la publicación científica y demostrar que el talento investigativo no tiene por qué esperar a un posgrado.'
      : 'The National Review of Sciences for Students is a peer-reviewed, Diamond Open Access, non-profit academic publication. Our purpose is to democratize access to scientific publishing and demonstrate that research talent does not have to wait for graduate school.',
    
    quote: isSpanish 
      ? '"Operamos como una iniciativa científica independiente, libre de afiliaciones institucionales restrictivas, lo que nos garantiza una autonomía editorial total."'
      : '"We operate as an independent scientific initiative, free from restrictive institutional affiliations, which guarantees us total editorial autonomy."',

    // Objectives
    objectivesTitle: isSpanish ? 'Objetivos Fundamentales' : 'Core Objectives',
    objectives: [
      {
        icon: UserGroupIcon,
        title: isSpanish ? 'Fomento de la Investigación Estudiantil' : 'Student Research Promotion',
        desc: isSpanish 
          ? 'Proporcionar una plataforma profesional donde estudiantes de educación media y superior puedan iniciarse en la comunicación científica formal.'
          : 'Provide a professional platform where secondary and higher education students can begin formal scientific communication.'
      },
      {
        icon: AcademicCapIcon,
        title: isSpanish ? 'Experiencia Académica Integral' : 'Comprehensive Academic Experience',
        desc: isSpanish 
          ? 'Ofrecer un espacio de publicación riguroso que opera bajo los mismos estándares de integridad que una revista consolidada, adaptando el enfoque al nivel formativo.'
          : 'Offer a rigorous publication space operating under the same integrity standards as established journals, adapting the approach to the formative level.'
      },
      {
        icon: HeartIcon,
        title: isSpanish ? 'Ciencia Abierta y Equidad' : 'Open Science and Equity',
        desc: isSpanish 
          ? 'Garantizar que la capacidad económica no sea barrera mediante el modelo Diamante (sin APC ni suscripciones).'
          : 'Ensure that economic capacity is not a barrier through the Diamond model (no APCs or subscriptions).'
      },
      {
        icon: LightBulbIcon,
        title: isSpanish ? 'Desarrollo de Competencias' : 'Competency Development',
        desc: isSpanish 
          ? 'Facilitar el aprendizaje del proceso editorial completo: preparación de manuscritos, citación Chicago, vocabularios controlados, respuesta a revisores, ética de publicación.'
          : 'Facilitate learning of the complete editorial process: manuscript preparation, Chicago citation, controlled vocabularies, reviewer response, publication ethics.'
      }
    ],

    // Scope
    scopeTitle: isSpanish ? 'Alcance Temático' : 'Thematic Scope',
    scopeSubtitle: isSpanish 
      ? 'Aceptamos contribuciones en español e inglés de todas las disciplinas académicas.'
      : 'We accept contributions in Spanish and English from all academic disciplines.',
    
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

    // Manuscript types
    typesTitle: isSpanish ? 'Tipos de Manuscritos Aceptados' : 'Accepted Manuscript Types',
    typesSubtitle: isSpanish 
      ? 'Cada tipo tiene requisitos específicos de estructura y contenido.'
      : 'Each type has specific structure and content requirements.',
    types: [
      {
        name: isSpanish ? 'Artículo de Investigación Original' : 'Original Research Article',
        length: isSpanish ? '3.000–8.000 palabras' : '3,000–8,000 words',
        desc: isSpanish 
          ? 'Presenta resultados inéditos de investigaciones empíricas o teóricas, estructurado bajo el formato IMRyD.'
          : 'Presents unpublished results of empirical or theoretical research, structured under IMRaD format.'
      },
      {
        name: isSpanish ? 'Ensayo Académico' : 'Academic Essay',
        length: isSpanish ? '3.000–6.000 palabras' : '3,000–6,000 words',
        desc: isSpanish 
          ? 'Texto argumentativo que desarrolla una tesis original sustentada en una revisión crítica de la literatura.'
          : 'Argumentative text that develops an original thesis supported by a critical literature review.'
      },
      {
        name: isSpanish ? 'Ensayo Reflexivo' : 'Reflective Essay',
        length: isSpanish ? '1.500–3.000 palabras' : '1,500–3,000 words',
        desc: isSpanish 
          ? 'Exposición de reflexiones personales sobre una experiencia o lectura, con conexión teórica.'
          : 'Exposition of personal reflections on an experience or reading, with theoretical connection.'
      },
      {
        name: isSpanish ? 'Reporte de Caso' : 'Case Report',
        length: isSpanish ? '2.000–4.000 palabras' : '2,000–4,000 words',
        desc: isSpanish 
          ? 'Describe un caso único e interesante (clínico, social, técnico) con análisis y lecciones aprendidas.'
          : 'Describes a unique and interesting case (clinical, social, technical) with analysis and lessons learned.'
      },
      {
        name: isSpanish ? 'Revisión Sistemática' : 'Systematic Review',
        length: isSpanish ? '4.000–10.000 palabras' : '4,000–10,000 words',
        desc: isSpanish 
          ? 'Resume críticamente la literatura existente sobre una pregunta específica con metodología explícita.'
          : 'Critically summarizes existing literature on a specific question with explicit methodology.'
      },
      {
        name: isSpanish ? 'Book Review (Reseña)' : 'Book Review',
        length: isSpanish ? '1.000–2.000 palabras' : '1,000–2,000 words',
        desc: isSpanish 
          ? 'Reseña crítica de un libro académico reciente con análisis y recomendación.'
          : 'Critical review of a recent academic book with analysis and recommendation.'
      }
    ],

    // Values
    valuesTitle: isSpanish ? 'Valores Diferenciadores' : 'Differentiating Values',
    values: [
      {
        icon: HeartIcon,
        title: isSpanish ? 'Sin Fines de Lucro' : 'Non-Profit',
        desc: isSpanish ? 'Acceso Abierto Diamante' : 'Diamond Open Access'
      },
      {
        icon: ShieldCheckIcon,
        title: isSpanish ? 'Doble Ciego Estricto' : 'Strict Double-Blind',
        desc: isSpanish ? 'Evaluación imparcial' : 'Impartial evaluation'
      },
      {
        icon: SparklesIcon,
        title: isSpanish ? 'Carácter Formativo' : 'Formative Character',
        desc: isSpanish ? 'Retroalimentación constructiva' : 'Constructive feedback'
      },
      {
        icon: GlobeAltIcon,
        title: isSpanish ? 'Multidisciplinario' : 'Multidisciplinary',
        desc: isSpanish ? 'Todas las áreas del conocimiento' : 'All areas of knowledge'
      },
      {
        icon: BookOpenIcon,
        title: isSpanish ? 'Bilingüe' : 'Bilingual',
        desc: isSpanish ? 'Español e Inglés' : 'Spanish and English'
      },
      {
        icon: CheckCircleIcon,
        title: isSpanish ? 'Estándares Internacionales' : 'International Standards',
        desc: isSpanish ? 'COPE, BOAI, CRediT, ICMJE' : 'COPE, BOAI, CRediT, ICMJE'
      }
    ],

    // Audience
    audienceTitle: isSpanish ? 'Público Objetivo' : 'Target Audience',
    audience: [
      {
        title: isSpanish ? 'Autores' : 'Authors',
        desc: isSpanish 
          ? 'Estudiantes de educación media (secundaria) y superior (universitaria) de Chile y Latinoamérica.'
          : 'Secondary and higher education students from Chile and Latin America.'
      },
      {
        title: isSpanish ? 'Lectores' : 'Readers',
        desc: isSpanish 
          ? 'Comunidad académica global, investigadores, docentes y estudiantes.'
          : 'Global academic community, researchers, educators, and students.'
      },
      {
        title: isSpanish ? 'Revisores' : 'Reviewers',
        desc: isSpanish 
          ? 'Académicos, profesores y estudiantes destacados con experiencia demostrable.'
          : 'Academics, professors, and outstanding students with demonstrable experience.'
      }
    ],

    // CTA
    ctaTitle: isSpanish ? '¿Listo para publicar?' : 'Ready to publish?',
    ctaText: isSpanish 
      ? 'Revisa nuestra guía completa para autores y comienza tu viaje en la publicación académica.'
      : 'Check our complete author guidelines and begin your journey in academic publishing.',
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
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* ENCABEZADO EDITORIAL */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-16 text-center"
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

        {/* MISIÓN */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="mb-20"
        >
          <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-6 text-center">
            {texts.missionTitle}
          </h3>
          
          <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <p className="text-[16px] text-[#2b2b2b] leading-relaxed font-sans">
                {texts.missionText1}
              </p>
              
              <blockquote className="border-l-4 border-[#e86125] pl-6 py-2">
                <p className="font-serif text-xl md:text-2xl font-light text-black leading-snug italic">
                  {texts.quote}
                </p>
              </blockquote>
            </div>
            
            <div className="lg:col-span-5">
              <div className="bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheckIcon className="w-8 h-8 text-[#002147]" />
                  <h4 className="font-serif font-semibold text-black text-lg">
                    {isSpanish ? 'Compromiso Editorial' : 'Editorial Commitment'}
                  </h4>
                </div>
                <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
                  {isSpanish 
                    ? 'Adheridos a los más altos estándares internacionales de ética y calidad académica. Nuestro compromiso es con la integridad científica y el desarrollo formativo de cada autor.'
                    : 'Adhering to the highest international standards of ethics and academic quality. Our commitment is to scientific integrity and the formative development of every author.'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* OBJETIVOS */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="mb-20"
        >
          <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-8 text-center">
            {texts.objectivesTitle}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {texts.objectives.map((obj, i) => (
              <motion.div 
                key={i}
                variants={staggerItem}
                className="bg-white border border-[#e6e8ea] rounded-sm p-6 hover:border-[#e86125] transition-colors shadow-sm hover:shadow-md group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#f4f5f7] rounded-sm flex items-center justify-center flex-shrink-0 group-hover:bg-[#e86125]/5 transition-colors">
                    <obj.icon className="w-6 h-6 text-[#002147] group-hover:text-[#e86125] transition-colors" />
                  </div>
                  <div>
                    <h4 className="font-serif font-semibold text-black mb-2 text-[15px] tracking-tight">
                      {obj.title}
                    </h4>
                    <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
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
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="mb-20"
        >
          <div className="text-center mb-8">
            <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-3">
              {texts.scopeTitle}
            </h3>
            <p className="text-[14px] text-[#666666] max-w-2xl mx-auto font-sans">
              {texts.scopeSubtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {texts.areas.map((area, i) => (
              <motion.div 
                key={i}
                variants={staggerItem}
                className="bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm p-5 hover:border-[#002147] transition-all hover:shadow-md group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <area.icon className="w-5 h-5 text-[#e86125] flex-shrink-0" />
                  <h4 className="font-serif font-semibold text-black text-[14px] tracking-tight">
                    {area.title}
                  </h4>
                </div>
                <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                  {area.disciplines}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* TIPOS DE MANUSCRITOS */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="mb-20"
        >
          <div className="text-center mb-8">
            <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-3">
              {texts.typesTitle}
            </h3>
            <p className="text-[14px] text-[#666666] max-w-2xl mx-auto font-sans">
              {texts.typesSubtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {texts.types.map((type, i) => (
              <motion.div 
                key={i}
                variants={staggerItem}
                className="flex items-start gap-4 bg-white border border-[#e6e8ea] rounded-sm p-5 hover:border-[#e86125] transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-[#e86125] rounded-full"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h4 className="font-serif font-semibold text-black text-[14px] tracking-tight">
                      {type.name}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#a0a0a0] bg-[#f4f5f7] px-2 py-1 rounded-sm flex-shrink-0 font-sans">
                      {type.length}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#666666] leading-relaxed font-sans">
                    {type.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* VALORES DIFERENCIADORES */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="mb-20"
        >
          <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-8 text-center">
            {texts.valuesTitle}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {texts.values.map((val, i) => (
              <motion.div 
                key={i}
                variants={staggerItem}
                className="text-center p-5 bg-[#f8f9fa] border border-[#e6e8ea] rounded-sm hover:border-[#e86125] transition-all"
              >
                <val.icon className="w-7 h-7 text-[#002147] mx-auto mb-3" />
                <h4 className="font-serif font-semibold text-black text-[13px] mb-1">
                  {val.title}
                </h4>
                <p className="text-[11px] text-[#a0a0a0] font-sans">
                  {val.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* PÚBLICO OBJETIVO */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="mb-20"
        >
          <h3 className="text-[13px] font-bold font-sans uppercase tracking-[0.2em] text-[#a0a0a0] mb-8 text-center">
            {texts.audienceTitle}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {texts.audience.map((aud, i) => (
              <motion.div 
                key={i}
                variants={staggerItem}
                className="bg-white border border-[#e6e8ea] rounded-sm p-6 text-center hover:shadow-md transition-all"
              >
                <h4 className="font-serif font-bold text-black text-[16px] mb-2">
                  {aud.title}
                </h4>
                <p className="text-[13px] text-[#666666] leading-relaxed font-sans">
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
          className="text-center border-t-2 border-[#e6e8ea] pt-12"
        >
          <h3 className="font-serif text-2xl text-black mb-3 tracking-tight">
            {texts.ctaTitle}
          </h3>
          <p className="text-[14px] text-[#666666] mb-6 font-sans">
            {texts.ctaText}
          </p>
          <a 
            href={texts.ctaLink}
            className="inline-flex items-center gap-2 bg-[#002147] hover:bg-[#e86125] text-white px-8 py-3.5 text-xs font-bold uppercase tracking-widest transition-colors font-sans rounded-sm"
          >
            {texts.ctaButton}
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </motion.div>
        
      </div>
    </section>
  );
}

export default AimsScopeSection;