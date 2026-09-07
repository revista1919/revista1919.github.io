import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import logo from '../../public/logo.png';
import logoEN from '../../public/logoEN.png';

const HomeSection = ({ onOpenMenu }) => {
  const navigate = useNavigate();
  const { switchLanguage, language } = useLanguage();
  const isSpanish = language === 'es';
  
  const handleLanguageToggle = () => {
    switchLanguage(isSpanish ? 'en' : 'es');
  };

  const cards = [
    {
      title: isSpanish ? 'Artículos' : 'Articles',
      desc: isSpanish 
        ? 'Artículos científicos elaborados por estudiantes y revisados por pares.'
        : 'Scientific articles written by students and peer-reviewed.',
      path: isSpanish ? '/article' : '/en/article/',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      bgImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=773&auto=format&fit=crop'
    },
    {
      title: isSpanish ? 'Números' : 'Issues',
      desc: isSpanish 
        ? 'Compilaciones de artículos organizados por edición semestral.'
        : 'Collections of articles organized by edition.',
      path: isSpanish ? '/volume' : '/en/volume/',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      bgImage: 'https://plus.unsplash.com/premium_photo-1677567996070-68fa4181775a?q=80&w=872&auto=format&fit=crop'
    },
    {
      title: isSpanish ? 'Manuscritos' : 'Manuscripts',
      desc: isSpanish 
        ? 'Información para autores, normativas y proceso de envío.'
        : 'Information for authors and the submission process.',
      path: isSpanish ? '/submit' : '/en/submit/',
      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
      bgImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=870&auto=format&fit=crop'
    },
    {
      title: isSpanish ? 'Noticias' : 'News',
      desc: isSpanish 
        ? 'Avisos, actividades y novedades de la comunidad científica.'
        : 'Announcements, activities, and updates from the student scientific community.',
      path: isSpanish ? '/new' : '/en/new/',
      icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
      bgImage: 'https://www.revistacienciasestudiantes.com/team.jpg'
    }
  ];

  const authorGuides = [
    {
      href: isSpanish ? '/quick.html' : '/quickEN.html',
      title: isSpanish ? 'Guía Rápida' : 'Interactive Quick Guide',
      category: isSpanish ? 'Interactivo' : 'Interactive',
      desc: isSpanish 
        ? 'Checklist visual de requisitos esenciales. Sin leer documentos largos.'
        : 'Visual checklist with the essentials. No long documents to read.',
      badge: '5 min'
    },
    {
      href: isSpanish ? '/author.html' : '/authorEN.html',
      title: isSpanish ? 'Manual del Autor' : 'Complete Author Guidelines',
      category: isSpanish ? 'Documento Extenso' : 'Extended Document',
      desc: isSpanish 
        ? 'Plantillas, métodos de citación y requisitos técnicos completos.'
        : 'Templates, citation examples, and technical requirements.',
    },
    {
      href: isSpanish ? '/practices.html' : '/practicesEN.html',
      title: isSpanish ? 'Buenas Prácticas' : 'Good Practices',
      category: isSpanish ? 'Ética' : 'Ethics',
      desc: isSpanish 
        ? 'Estándares éticos y declaración de originalidad.'
        : 'Ethical standards and best practices for publishing.',
    },
    {
      href: isSpanish ? '/open-access.html' : '/open-accessEN.html',
      title: isSpanish ? 'Open Access' : 'Open Access',
      category: isSpanish ? 'Licenciamiento' : 'Licensing',
      desc: isSpanish 
        ? 'Políticas de acceso abierto y derechos de retención.'
        : 'Open access policies, licenses, and copyright information.',
    },
    {
      href: isSpanish ? '/peer-review.html' : '/peer-reviewEN.html',
      title: isSpanish ? 'Peer Review' : 'Peer Review',
      category: isSpanish ? 'Proceso' : 'Process',
      desc: isSpanish 
        ? 'Política de revisión por pares y flujo editorial.'
        : 'Peer review policy and editorial workflow.',
    },
    {
      href: isSpanish ? '/copyright-and-license.html' : '/copyright-and-licenseEN.html',
      title: isSpanish ? 'Licencias' : 'Licenses',
      category: isSpanish ? 'Derechos' : 'Rights',
      desc: isSpanish 
        ? 'Licencia y derechos de autor.'
        : 'License and copyright information.',
    }
  ];

  const handleNavigate = (path) => {
    if (isSpanish) {
      navigate(path);
    } else {
      // Para inglés, usar la URL completa
      window.location.href = `https://www.revistacienciasestudiantes.com${path}`;
    }
  };

  const Card = ({ card, index }) => {
    const [imageLoaded, setImageLoaded] = React.useState(false);
    
    return (
      <motion.div
        key={card.path}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
        onClick={() => handleNavigate(card.path)}
        className="group relative bg-white flex flex-col cursor-pointer hover:bg-gray-50 transition-colors h-full border border-gray-200"
      >
        <div className="h-48 overflow-hidden border-b border-gray-200">
          <img 
            src={card.bgImage} 
            alt={card.title}
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover grayscale-[100%] group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
        <div className="p-8 flex flex-col flex-grow">
          <h3 className="text-xl font-serif text-[#004b87] mb-3">
            {card.title}
          </h3>
          <p className="text-sm text-gray-600 mb-6 flex-grow leading-relaxed">
            {card.desc}
          </p>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#004b87] group-hover:underline underline-offset-4 mt-auto">
            {isSpanish ? 'Explorar →' : 'Explore →'}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="relative bg-[#FAFAFA] font-sans text-[#1a1a1a] min-h-screen">
      
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 pt-6 pb-20">
        
        {/* HEADER EDITORIAL */}
        <header className="flex items-center justify-between mb-16 border-b-2 border-black pb-6">
          {/* LADO IZQUIERDO: Menú */}
          <div className="flex-1 flex justify-start">
            <button
              onClick={onOpenMenu}
              className="group flex items-center gap-3 hover:text-[#004b87] transition-colors focus:outline-none"
              aria-label={isSpanish ? 'Abrir menú' : 'Open menu'}
            >
              <div className="space-y-1.5">
                <div className="w-6 h-px bg-current transition-all"></div>
                <div className="w-6 h-px bg-current"></div>
                <div className="w-4 h-px bg-current group-hover:w-6 transition-all"></div>
              </div>
              <span className="hidden sm:block text-[10px] font-medium uppercase tracking-[0.2em]">
                {isSpanish ? 'Índice' : 'Menu'}
              </span>
            </button>
          </div>
          
          {/* CENTRO: Logo */}
          <div className="flex-shrink-0 px-4">
            <motion.div
              onClick={() => handleNavigate(isSpanish ? '/' : '/en/')}
              className="cursor-pointer"
              whileHover={{ opacity: 0.8 }}
            >
              <img
                src={isSpanish ? logo : logoEN}
                alt={isSpanish ? 'Revista Logo' : 'Journal Logo'}
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </motion.div>
          </div>
          
          {/* LADO DERECHO: Selector de idioma */}
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleLanguageToggle}
              className="flex border border-gray-300 text-[10px] font-medium tracking-[0.2em] uppercase"
              title={isSpanish ? 'Switch to English' : 'Cambiar a Español'}
            >
              <span className={`px-3 py-1.5 transition-colors ${isSpanish ? 'bg-[#004b87] text-white' : 'bg-transparent text-gray-500 hover:text-black'}`}>ES</span>
              <span className={`px-3 py-1.5 transition-colors ${!isSpanish ? 'bg-[#004b87] text-white' : 'bg-transparent text-gray-500 hover:text-black'}`}>EN</span>
            </button>
          </div>
        </header>

        {/* HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7 relative z-10"
          >
            <div className="border-l-2 border-[#004b87] pl-6 mb-8">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.2em] block mb-2">
                ISSN 3087-2839
              </span>
              <span className="text-[10px] font-medium text-[#004b87] uppercase tracking-[0.2em] block">
                {isSpanish ? 'Revista Nacional de las Ciencias para Estudiantes' : 'The National Review of Sciences for Students'}
              </span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-[5rem] font-serif font-medium text-[#1a1a1a] leading-[1.05] mb-8">
              {isSpanish ? (
                <>
                  Un espacio para el <br />
                  <span className="italic text-[#004b87]">trabajo científico</span> <br />
                  estudiantil.
                </>
              ) : (
                <>
                  A space for <br />
                  <span className="italic text-[#004b87]">student scientific</span> <br />
                  work.
                </>
              )}
            </h1>
            
            <p className="text-lg text-gray-600 mb-10 font-light leading-relaxed max-w-xl">
              {isSpanish 
                ? 'Publicación académica de acceso abierto dedicada a la difusión de investigaciones desarrolladas por estudiantes, promoviendo el escrutinio riguroso y la discusión formal.'
                : 'Open access academic publication dedicated to disseminating research developed by students, promoting rigorous scrutiny and formal discussion.'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleNavigate(isSpanish ? '/article' : '/en/article/')}
                className="px-8 py-4 bg-[#004b87] text-white font-medium text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-colors rounded-none"
              >
                {isSpanish ? 'Ver volumen actual' : 'View current issue'}
              </button>
              <button
                onClick={() => handleNavigate(isSpanish ? '/about' : '/en/about/')}
                className="px-8 py-4 border border-gray-300 text-[#1a1a1a] font-medium text-[10px] uppercase tracking-[0.2em] hover:border-[#004b87] transition-colors rounded-none"
              >
                {isSpanish ? 'Sobre la revista' : 'About the journal'}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="lg:col-span-5 relative hidden lg:block"
          >
            <div className="aspect-[3/4] border border-gray-300 bg-gray-100 p-2 rounded-none">
              <img
                src="https://images.unsplash.com/photo-1616017640739-44ce2bfd9b4e?q=80&w=1374&auto=format&fit=crop"
                alt={isSpanish ? 'Laboratorio Estudiantil' : 'Student Laboratory'}
                className="w-full h-full object-cover grayscale-[80%] hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </motion.div>
        </div>

        {/* SECCIONES PRINCIPALES */}
        <div className="mb-24">
          <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
            <h2 className="text-2xl font-serif text-[#1a1a1a]">
              {isSpanish ? 'Directorio de Contenidos' : 'Content Directory'}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-300 border border-gray-300 rounded-none">
            {cards.map((card, index) => (
              <Card key={card.path} card={card} index={index} />
            ))}
          </div>
        </div>

        {/* INFORMACIÓN PARA AUTORES */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-24"
        >
          <div className="border-t-4 border-[#004b87] bg-white border-b border-x border-gray-300 rounded-none">
            <div className="p-6 md:p-8 border-b border-gray-300 bg-[#FAFAFA]">
              <h2 className="text-2xl font-serif font-medium text-[#1a1a1a] mb-2">
                {isSpanish ? 'Información para Autores' : 'Information for Authors'}
              </h2>
              <p className="text-sm text-gray-500 font-serif italic">
                {isSpanish 
                  ? 'Documentación normativa y requerimientos de publicación.'
                  : 'Normative documentation and publication requirements.'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 divide-gray-300">
              {authorGuides.map((guide, index) => (
                <a 
                  key={index}
                  href={guide.href}
                  className={`group p-6 hover:bg-[#FAFAFA] transition-colors flex flex-col h-full ${index % 3 !== 0 ? 'lg:border-l lg:border-gray-200' : ''}`}
                >
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400 mb-4">
                    {guide.category}
                  </div>
                  <h3 className="text-sm font-medium text-[#1a1a1a] mb-2">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-6 flex-grow">
                    {guide.desc}
                  </p>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-[#004b87] mt-auto">
                    {isSpanish ? 'Consultar →' : 'View →'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </motion.div>

{/* INVITACIÓN */}
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
  className="bg-[#002147] p-12 md:p-20 text-center border-y border-black rounded-none"
>
  <div className="max-w-3xl mx-auto">
    <div className="text-white/60 mb-6">
      <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
    </div>
    <h2 className="text-2xl md:text-4xl font-serif font-medium text-white mb-6 leading-relaxed">
      {isSpanish 
        ? 'La ciencia se construye aprendiendo y sometiendo los hallazgos al escrutinio de pares.'
        : 'Science is built by learning and subjecting findings to peer scrutiny.'}
    </h2>
    <p className="text-white/70 font-light mb-10 text-sm md:text-base leading-relaxed">
      {isSpanish 
        ? 'Invitamos a estudiantes e investigadores emergentes a participar en el proyecto editorial, ya sea sometiendo sus manuscritos o integrándose al cuerpo de revisores técnicos.'
        : 'We invite students and emerging researchers to participate in the editorial project, either by submitting their manuscripts or joining the technical review board.'}
    </p>
    <button
      onClick={() => handleNavigate('/admin')}
      className="px-10 py-4 bg-white text-[#002147] text-[10px] font-medium uppercase tracking-[0.2em] hover:bg-gray-100 transition-colors rounded-none"
    >
      {isSpanish ? 'Consultar Convocatorias Activas' : 'View Active Calls'}
    </button>
  </div>
</motion.div>
      </div>
    </div>
  );
};

export default HomeSection;