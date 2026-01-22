import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

const HomeSection = () => {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);

  const cards = [
    {
      title: 'Artículos',
      desc: 'Artículos científicos elaborados por estudiantes y revisados por pares.',
      path: '/article',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    },
    {
      title: 'Volúmenes',
      desc: 'Compilaciones de artículos organizados por edición.',
      path: '/volume',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    },
    {
      title: 'Manuscritos',
      desc: 'Información para autores y proceso de envío de trabajos.',
      path: '/submit',
      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
    },
    {
      title: 'Noticias',
      desc: 'Avisos, actividades y novedades de la comunidad científica estudiantil.',
      path: '/new',
      icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
    },
  ];

  return (
    <div className="relative overflow-hidden bg-white">
      <div className="absolute top-0 left-0 w-full h-[100vh] overflow-hidden pointer-events-none opacity-20 z-0">
        <motion.div style={{ y: y1 }} className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
        <motion.div style={{ y: y1 }} className="absolute top-1/2 -left-24 w-80 h-80 bg-gray-100 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32">
        
        {/* HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.4em] mb-4 block">
              Revista Nacional de las Ciencias para Estudiantes
            </span>

            <h1 className="text-5xl md:text-7xl font-serif font-bold text-gray-900 leading-[1.1] mb-6">
              Un espacio para el <span className="italic text-gray-500 underline decoration-blue-200 underline-offset-8">trabajo científico</span> estudiantil
            </h1>

            <p className="text-lg text-gray-600 mb-10 font-light leading-relaxed max-w-lg">
              La Revista Nacional de las Ciencias para Estudiantes es una plataforma dedicada a la difusión de trabajos científicos desarrollados por estudiantes, promoviendo el aprendizaje y la discusión académica.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/article')}
                className="px-10 py-4 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl hover:-translate-y-1"
              >
                Ver artículos
              </button>

              <button
                onClick={() => navigate('/about')}
                className="px-10 py-4 border border-gray-200 text-gray-900 font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
              >
                Sobre la revista
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="hidden lg:block relative"
          >
            <div className="aspect-[4/5] bg-gray-100 rounded-2xl overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-700">
              <img
                src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=1000"
                alt="Trabajo científico estudiantil"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, index) => (
            <motion.div
              key={card.path}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(card.path)}
              className="group relative bg-white p-10 border border-gray-100 hover:border-blue-200 hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
            >
              <div className="relative z-10">
                <div className="w-12 h-12 mb-8 text-gray-300 group-hover:text-blue-600 transition-colors">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                  </svg>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {card.title}
                </h3>

                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  {card.desc}
                </p>

                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                  Acceder →
                </span>
              </div>

              <div className="absolute top-0 left-0 w-1 h-0 bg-blue-600 group-hover:h-full transition-all duration-300" />
            </motion.div>
          ))}
        </div>

        {/* INVITACIÓN */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 relative rounded-3xl overflow-hidden bg-gray-900 p-12 lg:p-20 text-center"
        >
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-white mb-6 italic">
              “La ciencia se construye aprendiendo y compartiendo.”
            </h2>

            <p className="text-gray-400 font-light mb-10">
              Invitamos a estudiantes interesados en la divulgación científica a participar en el proyecto editorial y en las distintas áreas de trabajo de la revista.
            </p>

            <button
              onClick={() => navigate('/admin')}
              className="px-12 py-4 bg-white text-gray-900 text-xs font-bold uppercase tracking-[0.3em] hover:bg-blue-500 hover:text-white transition-all"
            >
              Conocer convocatoria
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default HomeSection;
